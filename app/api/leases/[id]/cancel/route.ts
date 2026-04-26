export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/emails/resend.service";
import { canCancelLease, type CancellationType } from "@/lib/services/lease-cancellation";

const VALID_CANCELLATION_TYPES: CancellationType[] = [
  "tenant_withdrawal",
  "owner_withdrawal",
  "mutual_agreement",
  "never_activated",
  "error",
  "duplicate",
];

/**
 * POST /api/leases/[id]/cancel — Annuler un bail
 *
 * Conditions :
 * - Le bail n'est pas dans un état terminal
 * - Si actif, aucun paiement réussi n'existe
 * - Le demandeur est le propriétaire du bien ou un admin
 *
 * Body: { reason: string, type: CancellationType }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Service-role + check explicite owner/admin
    // (cf. docs/audits/rls-cascade-audit.md)
    const supabase = getServiceClient();

    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        statut,
        type_bail,
        property_id,
        property:properties(
          id,
          owner_id,
          name,
          adresse_complete,
          ville
        ),
        signers:lease_signers(
          profile_id,
          role,
          invited_email,
          invited_name,
          profile:profiles(id, prenom, nom, email)
        )
      `)
      .eq("id", leaseId)
      .maybeSingle();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const leaseData = lease as any;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property?.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission d'annuler ce bail" },
        { status: 403 }
      );
    }

    // 3. Compter les paiements réussis
    const { count: paymentCount } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("lease_id", leaseId as any)
      .eq("statut", "paid" as any);

    // 4. Vérifier si le bail peut être annulé
    const check = canCancelLease({
      id: leaseData.id,
      statut: leaseData.statut,
      paymentCount: paymentCount ?? 0,
    });

    if (!check.canCancel) {
      return NextResponse.json(
        { error: check.reason },
        { status: 400 }
      );
    }

    // 5. Valider le body
    const body = await request.json().catch(() => ({}));
    const { reason, type } = body as { reason?: string; type?: string };

    if (!type || !VALID_CANCELLATION_TYPES.includes(type as CancellationType)) {
      return NextResponse.json(
        { error: "Type d'annulation invalide. Types autorisés : " + VALID_CANCELLATION_TYPES.join(", ") },
        { status: 400 }
      );
    }

    // 6. Annuler le bail
    const { data: updated, error: updateError } = await supabase
      .from("leases")
      .update({
        statut: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason || null,
        cancellation_type: type,
      } as any)
      .eq("id", leaseId as any)
      .select()
      .single();

    if (updateError) {
      console.error("[CANCEL Lease] Update error:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de l'annulation du bail" },
        { status: 500 }
      );
    }

    // 7. Archiver les documents liés (ged_status → archived)
    await supabase
      .from("documents")
      .update({ ged_status: "archived" } as any)
      .eq("lease_id", leaseId as any)
      .eq("ged_status", "active" as any);

    // 8. Annuler les factures en attente
    await supabase
      .from("invoices")
      .update({ statut: "cancelled" } as any)
      .eq("lease_id", leaseId as any)
      .in("statut", ["draft", "sent"] as any);

    // 9. Émettre l'événement dans l'outbox
    await supabase.from("outbox").insert({
      event_type: "Lease.Cancelled",
      payload: {
        lease_id: leaseId,
        cancelled_by: user.id,
        cancellation_type: type,
        cancellation_reason: reason,
        property_id: leaseData.property_id,
      },
    } as any);

    // 10. Journal d'audit
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "lease_cancelled",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        previous_status: leaseData.statut,
        cancellation_type: type,
        cancellation_reason: reason,
      },
    } as any);

    // 11. Notifier les locataires par email
    const tenantSigners = leaseData.signers?.filter(
      (s: any) => s.role === "locataire_principal" || s.role === "colocataire"
    ) || [];

    for (const signer of tenantSigners) {
      const email = signer.profile?.email || signer.invited_email;
      if (!email) continue;

      const tenantName = signer.profile
        ? `${signer.profile.prenom || ""} ${signer.profile.nom || ""}`.trim()
        : signer.invited_name || "";

      const propertyLabel = leaseData.property?.adresse_complete
        ? `${leaseData.property.adresse_complete}, ${leaseData.property.ville || ""}`
        : leaseData.property?.name || "votre logement";

      try {
        await sendEmail({
          to: email,
          subject: `Bail annulé — ${propertyLabel}`,
          html: `
            <p>Bonjour ${tenantName || ""},</p>
            <p>Le bail concernant le bien situé au <strong>${propertyLabel}</strong> a été annulé.</p>
            ${reason ? `<p><strong>Motif :</strong> ${reason}</p>` : ""}
            <p>Si vous avez des questions, n'hésitez pas à contacter votre propriétaire.</p>
            <p>L'équipe Talok</p>
          `,
          tags: [{ name: "category", value: "lease_cancelled" }],
        });
      } catch (emailError) {
        console.error("[CANCEL Lease] Email notification error:", emailError);
      }
    }

    // 12. Revalider le cache
    revalidatePath("/owner/leases");
    revalidatePath(`/owner/leases/${leaseId}`);
    if (leaseData.property_id) {
      revalidatePath(`/owner/properties/${leaseData.property_id}`);
      revalidatePath("/owner/properties");
    }

    return NextResponse.json({
      success: true,
      lease: updated,
      message: "Le bail a été annulé avec succès.",
    });
  } catch (error: unknown) {
    console.error("[CANCEL Lease] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
