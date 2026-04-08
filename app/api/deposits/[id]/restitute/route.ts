export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { withSecurity } from "@/lib/api/with-security";

/**
 * POST /api/deposits/[id]/restitute — Restituer un dépôt de garantie
 *
 * Body:
 *   - restitution_amount_cents: number (montant à restituer)
 *   - retenue_cents: number (montant retenu, défaut 0)
 *   - retenue_details: array (détails des retenues)
 *   - restitution_method: 'virement' | 'cheque' | 'especes'
 *   - notes: string (optionnel)
 *
 * Règles métier:
 *   - Le bail doit être terminé
 *   - Le dépôt doit être en statut 'received'
 *   - restitution_amount_cents + retenue_cents = amount_cents
 *   - Si EDL conforme : restitution sous 1 mois
 *   - Si dégradations : restitution sous 2 mois, retenues justifiées
 *   - Pénalité de retard : 10% loyer/mois
 */
export const POST = withSecurity(
  async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id: depositId } = await params;
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const serviceClient = getServiceClient();

    // Récupérer le profil
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    // Récupérer le dépôt avec le bail
    const { data: deposit, error: depositError } = await serviceClient
      .from("security_deposits")
      .select(
        `
        *,
        lease:leases!inner(
          id,
          statut,
          date_fin,
          loyer,
          type_bail,
          property:properties!inner(
            id,
            owner_id,
            adresse_complete
          )
        )
      `
      )
      .eq("id", depositId)
      .single();

    if (depositError || !deposit) {
      return NextResponse.json(
        { error: "Dépôt de garantie non trouvé" },
        { status: 404 }
      );
    }

    const depositData = deposit as any;

    // Vérifier les permissions
    const isOwner = depositData.lease?.property?.owner_id === profileData.id;
    const isAdmin = profileData.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut restituer le dépôt" },
        { status: 403 }
      );
    }

    // Vérifier le statut du dépôt
    if (depositData.status !== "received") {
      return NextResponse.json(
        {
          error: `Impossible de restituer : le dépôt est en statut "${depositData.status}"`,
        },
        { status: 400 }
      );
    }

    // Vérifier que le bail est terminé
    if (depositData.lease?.statut !== "terminated" && depositData.lease?.statut !== "ended") {
      return NextResponse.json(
        { error: "Le bail doit être terminé pour restituer le dépôt" },
        { status: 400 }
      );
    }

    // Parser le body
    const body = await request.json();
    const {
      restitution_amount_cents,
      retenue_cents = 0,
      retenue_details = [],
      restitution_method,
      notes,
    } = body;

    // Validations
    if (restitution_amount_cents == null || restitution_amount_cents < 0) {
      return NextResponse.json(
        { error: "Montant de restitution invalide" },
        { status: 400 }
      );
    }

    if (retenue_cents < 0) {
      return NextResponse.json(
        { error: "Montant de retenue invalide" },
        { status: 400 }
      );
    }

    // Vérifier que la somme correspond
    if (restitution_amount_cents + retenue_cents !== depositData.amount_cents) {
      return NextResponse.json(
        {
          error: `La somme (restitution ${restitution_amount_cents} + retenues ${retenue_cents}) ne correspond pas au dépôt (${depositData.amount_cents} centimes)`,
        },
        { status: 400 }
      );
    }

    if (!restitution_method || !["virement", "cheque", "especes"].includes(restitution_method)) {
      return NextResponse.json(
        { error: "Méthode de restitution invalide (virement, cheque, especes)" },
        { status: 400 }
      );
    }

    // Retenues doivent être justifiées
    if (retenue_cents > 0 && (!retenue_details || retenue_details.length === 0)) {
      return NextResponse.json(
        { error: "Les retenues doivent être détaillées et justifiées" },
        { status: 400 }
      );
    }

    // Calculer la pénalité de retard éventuelle (10% loyer/mois)
    let latePenaltyCents = 0;
    if (depositData.restitution_due_date) {
      const dueDate = new Date(depositData.restitution_due_date);
      const now = new Date();
      if (now > dueDate) {
        const monthsLate = Math.ceil(
          (now.getTime() - dueDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
        );
        const monthlyRentCents = (depositData.lease?.loyer || 0) * 100;
        latePenaltyCents = Math.round(monthlyRentCents * 0.1 * monthsLate);
      }
    }

    // Déterminer le statut final
    const newStatus = retenue_cents > 0 ? "partially_returned" : "returned";

    // Mettre à jour le dépôt
    const { data: updatedDeposit, error: updateError } = await serviceClient
      .from("security_deposits")
      .update({
        restitution_amount_cents,
        retenue_cents,
        retenue_details,
        restitution_method,
        restituted_at: new Date().toISOString(),
        late_penalty_cents: latePenaltyCents,
        status: newStatus,
        metadata: {
          ...(depositData.metadata || {}),
          notes,
          restituted_by: user.id,
        },
      })
      .eq("id", depositId)
      .select()
      .single();

    if (updateError) {
      console.error("[deposits/restitute] Update error:", updateError);
      throw updateError;
    }

    // Notifier le locataire
    const { data: tenantProfile } = await serviceClient
      .from("profiles")
      .select("user_id, prenom, nom")
      .eq("id", depositData.tenant_id)
      .single();

    if (tenantProfile?.user_id) {
      const amountEur = (restitution_amount_cents / 100).toFixed(2);
      await serviceClient.from("notifications").insert({
        user_id: tenantProfile.user_id,
        type: "deposit_refund",
        title: "Restitution de votre dépôt de garantie",
        body:
          restitution_amount_cents > 0
            ? `Votre dépôt sera restitué : ${amountEur}€ par ${restitution_method}.`
            : `Votre dépôt a été intégralement retenu (retenues justifiées).`,
        priority: "high",
        metadata: {
          deposit_id: depositId,
          lease_id: depositData.lease_id,
          restitution_amount_cents,
          retenue_cents,
          late_penalty_cents: latePenaltyCents,
        },
      });
    }

    // Émettre un événement outbox
    await serviceClient.from("outbox").insert({
      event_type: "Deposit.Restituted",
      payload: {
        deposit_id: depositId,
        lease_id: depositData.lease_id,
        tenant_id: depositData.tenant_id,
        restitution_amount_cents,
        retenue_cents,
        late_penalty_cents: latePenaltyCents,
        restitution_method,
        property_address: depositData.lease?.property?.adresse_complete,
      },
    });

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "deposit_restituted",
      entity_type: "security_deposit",
      entity_id: depositId,
      metadata: {
        lease_id: depositData.lease_id,
        restitution_amount_cents,
        retenue_cents,
        retenue_details,
        late_penalty_cents: latePenaltyCents,
        restitution_method,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        newStatus === "returned"
          ? "Dépôt intégralement restitué"
          : "Restitution partielle enregistrée",
      deposit: updatedDeposit,
      late_penalty_cents: latePenaltyCents,
    });
  },
  { routeName: "POST /api/deposits/[id]/restitute", csrf: true }
);
