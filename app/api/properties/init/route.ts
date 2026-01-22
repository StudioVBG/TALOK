export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { z } from "zod";
import { generateCode } from "@/lib/helpers/code-generator";

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

// Schéma minimal pour l'initialisation
const initSchema = z.object({
  type: z.string().min(1, "Le type de bien est requis"),
  // Optionnels pour l'instant, on peut initialiser juste avec le type
  adresse: z.string().optional(),
  cp: z.string().optional(),
  ville: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // 2. Récupérer le profil propriétaire
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Profil propriétaire requis" }, { status: 403 });
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

    // 4. Get service client for bypassing RLS on insert
    let serviceClient;
    try {
      serviceClient = getServiceClient();
    } catch (err) {
      console.error("[POST /api/properties/init] Service client error:", err);
      return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
    }

    // 5. Générer un code unique pour la propriété
    let uniqueCode: string;
    let attempts = 0;
    do {
      uniqueCode = await generateCode();
      const { data: existing } = await serviceClient
        .from("properties")
        .select("id")
        .eq("unique_code", uniqueCode)
        .maybeSingle();
      if (!existing) break;
      attempts++;
      if (attempts >= 10) {
        console.error("[POST /api/properties/init] Failed to generate unique code after 10 attempts");
        return NextResponse.json({ error: "Impossible de générer un code unique" }, { status: 500 });
      }
    } while (true);

    // 6. Créer le brouillon (Draft) avec un minimum de données
    // On utilise des valeurs par défaut sûres pour éviter les erreurs de contraintes
    const departement = getDepartementFromCP(cp);

    const insertData: Record<string, any> = {
      owner_id: profile.id,
      type: type, // Correspond au champ 'type' de la table properties
      etat: "draft", // Toujours 'draft' au début
      unique_code: uniqueCode, // Code unique obligatoire
      // Champs obligatoires mais qu'on peut mettre par défaut pour un draft
      adresse_complete: adresse || "",
      code_postal: cp || "",
      ville: ville || "",
      departement: departement || "", // Valeur par défaut vide si pas de CP (évite NOT NULL constraint)
      surface: 0,
      nb_pieces: 0,
      // On initialise les compteurs à 0
      loyer_hc: 0,
      charges_mensuelles: 0,
    };

    console.log("[POST /api/properties/init] Inserting property:", { type, owner_id: profile.id });

    // Use service client to bypass RLS for initial insert
    const { data: property, error: insertError } = await serviceClient
      .from("properties")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("Erreur création property:", insertError);
      console.error("Données tentées:", insertData);
      return NextResponse.json({ 
        error: "Erreur lors de la création", 
        details: insertError.message,
        code: insertError.code 
      }, { status: 500 });
    }

    // ✅ SOTA 2026: Émettre une notification pour le brouillon créé
    try {
      await serviceClient.from("outbox").insert({
        event_type: "Property.DraftCreated",
        payload: {
          property_id: property.id,
          owner_user_id: user.id,
          property_type: type,
        },
      });
    } catch (notifError) {
      // Ne pas bloquer si la notification échoue
      console.warn("[POST /api/properties/init] Notification non envoyée:", notifError);
    }

    console.log("[POST /api/properties/init] Success:", property.id);

    return NextResponse.json({ 
      success: true, 
      propertyId: property.id,
      status: "draft"
    });

  } catch (error: unknown) {
    console.error("[POST /api/properties/init] Unexpected error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erreur serveur inattendue"
    }, { status: 500 });
  }
}

