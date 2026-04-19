export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";
import { generateCode } from "@/lib/helpers/code-generator";
import { withSubscriptionLimit } from "@/lib/middleware/subscription-check";
import { syncPropertyBillingToStripe } from "@/lib/stripe/sync-property-billing";
import { applyRateLimit } from "@/lib/middleware/rate-limit";

/**
 * Extrait le code département depuis un code postal
 * - DROM (97xxx): retourne 3 caractères (971, 972, 973, 974, 976)
 * - Corse (20xxx): retourne 2A ou 2B selon la commune
 * - Métropole: retourne 2 caractères
 */
function getDepartementFromCP(codePostal: string | null | undefined): string | null {
  if (!codePostal || codePostal.length < 2) return null;
  
  // DROM: codes postaux commençant par 97
  if (codePostal.startsWith("97")) {
    return codePostal.substring(0, 3); // 971, 972, 973, 974, 976
  }
  
  // Corse: codes postaux commençant par 20
  if (codePostal.startsWith("20")) {
    const cp = parseInt(codePostal, 10);
    return cp < 20200 ? "2A" : "2B";
  }
  
  // Métropole: 2 premiers chiffres
  return codePostal.substring(0, 2);
}

const propertyTypeEnum = z.enum([
  "appartement", "maison", "studio", "colocation", "saisonnier",
  "parking", "box",
  "local_commercial", "bureaux", "entrepot", "fonds_de_commerce",
  "immeuble", "terrain_agricole", "exploitation_agricole",
], { errorMap: () => ({ message: "Type de bien invalide" }) });

const initSchema = z.object({
  type: propertyTypeEnum,
  adresse: z.string().optional(),
  cp: z.string().optional(),
  ville: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const rateLimitResponse = applyRateLimit(request, "property");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();

    // 1. Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // 2. Récupérer le profil propriétaire via service role (évite la récursion RLS 42P17 sur profiles)
    const serviceClient = createServiceRoleClient();
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Profil propriétaire requis" }, { status: 403 });
    }

    // 2b. Vérifier les limites d'abonnement
    const limitCheck = await withSubscriptionLimit(profile.id, "properties");
    if (!limitCheck.allowed) {
      console.error(`[properties/init] SUBSCRIPTION_LIMIT: profile.id=${profile.id}, user.id=${user.id}, plan=${limitCheck.plan}, current=${limitCheck.current}, max=${limitCheck.max}`);
      return NextResponse.json({
        error: "SUBSCRIPTION_LIMIT",
        message: limitCheck.message,
        details: {
          current: limitCheck.current,
          max: limitCheck.max,
          remaining: limitCheck.remaining,
          plan: limitCheck.plan,
          debug_profile_id: profile.id,
        },
        upgrade_url: "/settings/billing",
      }, { status: 403 });
    }

    // 3. Valider les données d'entrée
    const body = await request.json();
    const validation = initSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ 
        error: "Données invalides", 
        details: validation.error.errors 
      }, { status: 400 });
    }

    const { type, adresse, cp, ville } = validation.data;

    // 3b. Reuse: si un draft du même type sans adresse existe déjà pour ce owner,
    // le retourner (idempotence du wizard, évite l'accumulation de drafts fantômes
    // qui se bloqueraient mutuellement via le trigger anti-doublon)
    const { data: existingDraft } = await serviceClient
      .from("properties")
      .select("id")
      .eq("owner_id", profile.id)
      .eq("type", type)
      .eq("etat", "draft")
      .or("adresse_complete.is.null,adresse_complete.eq.")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDraft) {
      return NextResponse.json({
        success: true,
        propertyId: existingDraft.id,
        status: "draft",
        reused: true,
      });
    }

    // 4. Générer un code unique pour la propriété
    let uniqueCode: string;
    let attempts = 0;
    do {
      uniqueCode = await generateCode();
      const { data: existing } = await supabase
        .from("properties")
        .select("id")
        .eq("unique_code", uniqueCode)
        .maybeSingle();
      if (!existing) break;
      attempts++;
      if (attempts >= 10) {
        return NextResponse.json({ error: "Impossible de générer un code unique" }, { status: 500 });
      }
    } while (true);

    // 5. Créer le brouillon (Draft) avec un minimum de données
    // On utilise des valeurs par défaut sûres pour éviter les erreurs de contraintes
    const departement = getDepartementFromCP(cp);
    
    // Réutiliser le service role client pour l'insert (cohérent avec /api/properties)
    const { data: defaultEntity } = await serviceClient
      .from("legal_entities")
      .select("id")
      .eq("owner_profile_id", profile.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const insertData: Record<string, any> = {
      owner_id: profile.id,
      legal_entity_id: defaultEntity?.id ?? null,
      type: type,
      etat: "draft",
      unique_code: uniqueCode,
      adresse_complete: adresse || "",
      code_postal: cp || "",
      ville: ville || "",
      departement: departement || "",
      surface: 0,
      nb_pieces: 0,
      nb_chambres: 0,
      ascenseur: false,
      loyer_hc: 0,
      charges_mensuelles: 0,
      // depot_garantie n'existe pas dans la table properties (c'est dans leases)
    };

    const { data: property, error: insertError } = await serviceClient
      .from("properties")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      // 23505 = unique_violation Postgres. Côté propriétés, la contrainte
      // qui déclenche le plus souvent ce code est le trigger métier
      // "1 brouillon actif par (owner, adresse, code_postal)" : on traite
      // le cas comme un 409 idempotent et on renvoie le brouillon existant
      // pour que le wizard puisse reprendre dessus au lieu de crasher.
      if (insertError.code === "23505") {
        const { data: existingDraft } = await serviceClient
          .from("properties")
          .select("id, etat")
          .eq("owner_id", profile.id)
          .eq("adresse_complete", insertData.adresse_complete)
          .eq("code_postal", insertData.code_postal)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return NextResponse.json({
          error: "DUPLICATE_PROPERTY",
          message: "Un brouillon existe déjà pour cette adresse. Reprenez-le ou supprimez-le avant d'en créer un nouveau.",
          details: insertError.message,
          existing_property_id: existingDraft?.id ?? null,
          existing_status: existingDraft?.etat ?? null,
        }, { status: 409 });
      }

      console.error("Erreur création property:", insertError);
      console.error("Données tentées:", insertData);
      return NextResponse.json({
        error: "Erreur lors de la création",
        details: insertError.message,
        code: insertError.code,
      }, { status: 500 });
    }

    // ✅ SOTA 2026: Émettre une notification pour le brouillon créé
    try {
      await supabase.from("outbox").insert({
        event_type: "Property.DraftCreated",
        payload: {
          property_id: property.id,
          owner_user_id: user.id,
          property_type: type,
        },
      });
    } catch (notifError) {
      // Ne pas bloquer si la notification échoue
      console.warn("Notification Property.DraftCreated non envoyée:", notifError);
    }

    // Sync facturation Stripe pour les biens supplémentaires
    try {
      await syncPropertyBillingToStripe(profile.id);
    } catch (billingError) {
      console.warn("[properties/init] Stripe billing sync failed:", billingError);
    }

    return NextResponse.json({ 
      success: true, 
      propertyId: property.id,
      status: "draft"
    });

  } catch (error) {
    console.error("Erreur inattendue:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

