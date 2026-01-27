export const runtime = 'nodejs';

/**
 * API Route pour configurer un mandat SEPA
 * POST /api/payments/setup-sepa - Créer un SetupIntent SEPA
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { sepaService } from "@/lib/stripe/sepa.service";
import { z } from "zod";

const setupSepaSchema = z.object({
  lease_id: z.string().uuid(),
  iban: z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,}$/, "IBAN invalide"),
  account_holder_name: z.string().min(2, "Nom du titulaire requis"),
  collection_day: z.number().int().min(1).max(28).default(5),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Valider les données
    const body = await request.json();
    const validatedData = setupSepaSchema.parse(body);

    // Vérifier que l'utilisateur est signataire du bail
    const { data: signer } = await supabase
      .from("lease_signers")
      .select("id, role")
      .eq("lease_id", validatedData.lease_id)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!signer && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Vous n'êtes pas signataire de ce bail" },
        { status: 403 }
      );
    }

    // Récupérer les infos du bail et du propriétaire
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id, loyer, charges_forfaitaires, depot_de_garantie,
        property:properties(
          id, adresse_complete,
          owner:profiles!properties_owner_id_fkey(
            id, prenom, nom,
            owner_profile:owner_profiles(iban, bic, titulaire_compte)
          )
        )
      `)
      .eq("id", validatedData.lease_id)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const owner = (lease.property as any)?.owner;
    const ownerProfile = owner?.owner_profile;

    if (!ownerProfile?.iban) {
      return NextResponse.json(
        { error: "Le propriétaire n'a pas configuré ses coordonnées bancaires" },
        { status: 400 }
      );
    }

    // Créer ou récupérer le client Stripe
    const customerName = `${profile.prenom} ${profile.nom}`;
    const customer = await sepaService.createOrGetCustomer(
      user.email!,
      customerName,
      {
        profile_id: profile.id,
        lease_id: validatedData.lease_id,
      }
    );

    // Créer le SetupIntent
    const setupIntent = await sepaService.createSepaSetupIntent(customer.id, {
      lease_id: validatedData.lease_id,
      profile_id: profile.id,
    });

    // Extraire les informations client pour conformité SEPA
    const clientInfo = {
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0].trim()
        || request.headers.get("x-real-ip")
        || "0.0.0.0",
      userAgent: request.headers.get("user-agent") || "Talok/1.0",
    };

    // Confirmer le SetupIntent avec l'IBAN
    const confirmedIntent = await sepaService.confirmSepaSetupIntent(
      setupIntent.id,
      validatedData.iban,
      validatedData.account_holder_name,
      user.email!,
      clientInfo
    );

    // Créer le mandat en base de données
    const serviceClient = createServiceRoleClient();
    const { data: mandate, error: mandateError } = await serviceClient
      .from("sepa_mandates")
      .insert({
        tenant_profile_id: profile.id,
        lease_id: validatedData.lease_id,
        owner_profile_id: owner.id,
        signature_date: new Date().toISOString().split("T")[0],
        debtor_name: validatedData.account_holder_name,
        debtor_iban: validatedData.iban,
        creditor_name: ownerProfile.titulaire_compte || `${owner.prenom} ${owner.nom}`,
        creditor_iban: ownerProfile.iban,
        creditor_bic: ownerProfile.bic,
        amount: lease.loyer + lease.charges_forfaitaires,
        status: confirmedIntent.status === "succeeded" ? "active" : "pending",
        signed_at: new Date().toISOString(),
        signature_method: "electronic",
        stripe_mandate_id: confirmedIntent.mandate,
        stripe_payment_method_id: confirmedIntent.payment_method,
        stripe_customer_id: customer.id,
        first_collection_date: getNextCollectionDate(validatedData.collection_day),
      })
      .select()
      .single();

    if (mandateError) {
      console.error("Erreur création mandat:", mandateError);
      return NextResponse.json({ error: mandateError.message }, { status: 500 });
    }

    // Créer l'échéancier de paiement
    await serviceClient
      .from("payment_schedules")
      .upsert({
        lease_id: validatedData.lease_id,
        payment_method: "sepa",
        mandate_id: mandate.id,
        collection_day: validatedData.collection_day,
        rent_amount: lease.loyer,
        charges_amount: lease.charges_forfaitaires,
        is_active: true,
        start_date: mandate.first_collection_date,
      }, {
        onConflict: "lease_id",
      });

    return NextResponse.json({
      success: true,
      mandate_id: mandate.id,
      mandate_reference: mandate.mandate_reference,
      status: mandate.status,
      first_collection_date: mandate.first_collection_date,
      amount: mandate.amount,
    }, { status: 201 });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur setup SEPA:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Calculer la prochaine date de prélèvement
 */
function getNextCollectionDate(day: number): string {
  const now = new Date();
  let nextDate = new Date(now.getFullYear(), now.getMonth(), day);

  // Si le jour est déjà passé ce mois, prendre le mois suivant
  if (nextDate <= now) {
    nextDate = new Date(now.getFullYear(), now.getMonth() + 1, day);
  }

  // Ajouter 5 jours de délai minimum pour SEPA
  const minDate = new Date(now);
  minDate.setDate(minDate.getDate() + 5);

  if (nextDate < minDate) {
    nextDate = new Date(now.getFullYear(), now.getMonth() + 1, day);
  }

  return nextDate.toISOString().split("T")[0];
}







