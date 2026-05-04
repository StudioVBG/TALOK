export const runtime = 'nodejs';

/**
 * API Route pour configurer un mandat SEPA
 * POST /api/payments/setup-sepa - Créer un SetupIntent SEPA
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { sepaService } from "@/lib/stripe/sepa.service";
import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";

const setupSepaSchema = z.object({
  lease_id: z.string().uuid(),
  iban: z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,}$/, "IBAN invalide"),
  account_holder_name: z.string().min(2, "Nom du titulaire requis"),
  collection_day: z.number().int().min(1).max(28).default(5),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const creditorName = process.env.SEPA_CREDITOR_NAME;
    const creditorIban = process.env.SEPA_CREDITOR_IBAN;
    const creditorBic = process.env.SEPA_CREDITOR_BIC ?? null;
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    if (!creditorName || !creditorIban) {
      return NextResponse.json(
        {
          error:
            "Le créancier SEPA de la plateforme n'est pas configuré. Renseignez SEPA_CREDITOR_NAME et SEPA_CREDITOR_IBAN avant d'activer le prélèvement.",
          code: "SEPA_CREDITOR_NOT_CONFIGURED",
        },
        { status: 503 }
      );
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
        id, loyer, charges_forfaitaires, depot_de_garantie, statut,
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

    // Refuser de créer un mandat SEPA tant que le bail n'est pas
    // entièrement signé. Sans cette garde, le locataire pouvait être
    // engagé dans des prélèvements automatiques avant que le bail soit
    // juridiquement actif (donc sans accord ferme côté propriétaire).
    const allowedStatuses = ["fully_signed", "active"];
    if (!allowedStatuses.includes((lease as any).statut)) {
      return NextResponse.json(
        {
          error:
            "Le mandat SEPA ne peut être créé qu'une fois le bail intégralement signé.",
          lease_status: (lease as any).statut,
        },
        { status: 409 }
      );
    }

    const owner = (lease.property as any)?.owner;
    const ownerProfile = owner?.owner_profile;

    if (!owner?.id) {
      return NextResponse.json(
        { error: "Le bail n'est pas correctement rattaché à un propriétaire" },
        { status: 409 }
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
    const scheduleAmount = Number(lease.loyer || 0) + Number(lease.charges_forfaitaires || 0);

    const { data: mandate, error: mandateError } = await serviceClient
      .from("sepa_mandates")
      .insert({
        tenant_profile_id: profile.id,
        lease_id: validatedData.lease_id,
        owner_profile_id: owner.id,
        signature_date: new Date().toISOString().split("T")[0],
        debtor_name: validatedData.account_holder_name,
        debtor_iban: validatedData.iban,
        creditor_name: creditorName,
        creditor_iban: creditorIban,
        creditor_bic: creditorBic,
        amount: scheduleAmount,
        status: confirmedIntent.status === "succeeded" ? "active" : "pending",
        signed_at: new Date().toISOString(),
        signature_method: "electronic",
        stripe_mandate_id: confirmedIntent.mandate,
        stripe_payment_method_id: confirmedIntent.payment_method,
        stripe_customer_id: customer.id,
        first_collection_date: getNextCollectionDate(validatedData.collection_day),
        metadata: {
          creditor_source: "platform",
          owner_profile_id: owner.id,
          owner_billing_name: ownerProfile?.titulaire_compte || `${owner.prenom} ${owner.nom}`,
        } as Json,
      })
      .select()
      .single();

    if (mandateError) {
      console.error("Erreur création mandat:", mandateError);
      return NextResponse.json({ error: mandateError.message }, { status: 500 });
    }

    const { data: paymentMethod } = await serviceClient
      .from("tenant_payment_methods")
      .upsert(
        {
          tenant_profile_id: profile.id,
          stripe_customer_id: customer.id,
          stripe_payment_method_id: confirmedIntent.payment_method,
          type: "sepa_debit",
          is_default: false,
          label: `SEPA •••• ${validatedData.iban.slice(-4)}`,
          sepa_last4: validatedData.iban.slice(-4),
          sepa_country: validatedData.iban.slice(0, 2),
          sepa_mandate_id: mandate.id,
          status: "active",
          metadata: {
            lease_id: validatedData.lease_id,
            source: "sepa_setup",
          } as Json,
        },
        { onConflict: "stripe_payment_method_id" }
      )
      .select("id")
      .single();

    // Créer l'échéancier de paiement
    await serviceClient
      .from("payment_schedules")
      .upsert({
        lease_id: validatedData.lease_id,
        payment_method_type: "sepa",
        mandate_id: mandate.id,
        payment_method_id: paymentMethod?.id ?? null,
        collection_day: validatedData.collection_day,
        rent_amount: lease.loyer,
        charges_amount: lease.charges_forfaitaires,
        is_active: true,
        start_date: mandate.first_collection_date,
        metadata: {
          source: "sepa_setup",
          stripe_payment_method_id: confirmedIntent.payment_method,
        } as Json,
      }, {
        onConflict: "lease_id",
      });

    await serviceClient.from("payment_method_audit_log").insert({
      tenant_profile_id: profile.id,
      payment_method_id: paymentMethod?.id ?? null,
      action: "mandate_created",
      details: {
        lease_id: validatedData.lease_id,
        mandate_id: mandate.id,
        collection_day: validatedData.collection_day,
      } as Json,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: request.headers.get("user-agent") ?? null,
    });

    return NextResponse.json({
      success: true,
      mandate_id: mandate.id,
      payment_method_id: paymentMethod?.id ?? null,
      mandate_reference: mandate.mandate_reference,
      status: mandate.status,
      first_collection_date: mandate.first_collection_date,
      amount: mandate.amount,
    }, { status: 201 });
  } catch (error: unknown) {
    if ((error as any).name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("Erreur setup SEPA:", error);
    return NextResponse.json(
      { error: error instanceof Error ? (error as Error).message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Renvoie le dernier jour calendaire d'un mois donné (1-indexed).
 * Ex : lastDayOfMonth(2026, 2) = 28 (ou 29 année bissextile).
 */
function lastDayOfMonth(year: number, monthOneBased: number): number {
  // Date(year, month, 0) renvoie le dernier jour du mois précédent.
  return new Date(year, monthOneBased, 0).getDate();
}

/**
 * Construit une Date au jour `day` du mois (year, monthZeroBased), en
 * cappant au dernier jour réel du mois si `day > lastDayOfMonth`.
 *
 * Bug fixé : `new Date(2026, 1, 29)` retournait silencieusement le
 * 1er mars (overflow), prélevant les locataires à une mauvaise date.
 */
function safeDateInMonth(year: number, monthZeroBased: number, day: number): Date {
  const last = lastDayOfMonth(year, monthZeroBased + 1);
  return new Date(year, monthZeroBased, Math.min(day, last));
}

/**
 * Calculer la prochaine date de prélèvement
 */
function getNextCollectionDate(day: number): string {
  const now = new Date();
  let nextDate = safeDateInMonth(now.getFullYear(), now.getMonth(), day);

  // Si le jour est déjà passé ce mois, prendre le mois suivant
  if (nextDate <= now) {
    nextDate = safeDateInMonth(now.getFullYear(), now.getMonth() + 1, day);
  }

  // Ajouter 5 jours de délai minimum pour SEPA
  const minDate = new Date(now);
  minDate.setDate(minDate.getDate() + 5);

  if (nextDate < minDate) {
    nextDate = safeDateInMonth(now.getFullYear(), now.getMonth() + 1, day);
  }

  return nextDate.toISOString().split("T")[0];
}







