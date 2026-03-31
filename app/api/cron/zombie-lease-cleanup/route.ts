export const runtime = "nodejs";

/**
 * GET /api/cron/zombie-lease-cleanup
 *
 * Cron job pour auto-annuler les baux "zombies" :
 * - Signés ou en cours de signature mais jamais activés
 * - Créés depuis plus de 30 jours
 * - Aucun paiement réussi
 *
 * Configuré pour s'exécuter toutes les nuits à 2h du matin.
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/emails/resend.service";

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return process.env.NODE_ENV === "development";
  }
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const results = {
    processed: 0,
    cancelled: 0,
    notified: 0,
    errors: [] as string[],
  };

  try {
    // 1. Trouver les baux zombies (signés/en cours mais jamais activés, > 30 jours)
    const { data: zombieLeases, error: queryError } = await supabase
      .from("leases")
      .select(`
        id,
        statut,
        created_at,
        property_id,
        property:properties!inner(
          id,
          name,
          adresse_complete,
          ville,
          owner_id
        ),
        signers:lease_signers(
          profile_id,
          role,
          invited_email,
          invited_name,
          profile:profiles(id, prenom, nom, email)
        )
      `)
      .in("statut", ["pending_signature", "partially_signed", "pending_owner_signature", "fully_signed"])
      .lt("created_at", thirtyDaysAgo.toISOString())
      .is("cancelled_at", null);

    if (queryError) {
      console.error("[CRON zombie-lease-cleanup] Query error:", queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!zombieLeases || zombieLeases.length === 0) {
      return NextResponse.json({
        message: "Aucun bail zombie trouvé",
        ...results,
      });
    }

    // 2. Pour chaque bail zombie, vérifier qu'il n'a aucun paiement réussi
    for (const lease of zombieLeases) {
      const leaseData = lease as any;
      results.processed++;

      try {
        const { count: paidCount } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("lease_id", leaseData.id)
          .eq("statut", "paid");

        if ((paidCount ?? 0) > 0) continue;

        // 3. Annuler le bail
        const { error: updateError } = await supabase
          .from("leases")
          .update({
            statut: "cancelled",
            cancelled_at: now.toISOString(),
            cancellation_reason: "Auto-expiration : bail en cours de signature sans activation depuis 30 jours",
            cancellation_type: "never_activated",
          } as any)
          .eq("id", leaseData.id);

        if (updateError) {
          results.errors.push(`Lease ${leaseData.id}: ${updateError.message}`);
          continue;
        }

        results.cancelled++;

        // 4. Archiver les documents et annuler les factures
        await supabase
          .from("documents")
          .update({ ged_status: "archived" } as any)
          .eq("lease_id", leaseData.id)
          .eq("ged_status", "active");

        await supabase
          .from("invoices")
          .update({ statut: "cancelled" } as any)
          .eq("lease_id", leaseData.id)
          .in("statut", ["draft", "sent"]);

        // 5. Journal d'audit
        await supabase.from("audit_log").insert({
          action: "lease_auto_cancelled",
          entity_type: "lease",
          entity_id: leaseData.id,
          metadata: {
            previous_status: leaseData.statut,
            cancellation_type: "never_activated",
            reason: "cron_zombie_cleanup",
            created_at: leaseData.created_at,
          },
        } as any);

        // 6. Notifier le propriétaire
        const ownerProfileId = leaseData.property?.owner_id;
        if (ownerProfileId) {
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("email, prenom, nom")
            .eq("id", ownerProfileId)
            .single();

          if (ownerProfile?.email) {
            const propertyLabel = leaseData.property?.adresse_complete
              ? `${leaseData.property.adresse_complete}, ${leaseData.property.ville || ""}`
              : leaseData.property?.name || "votre bien";

            try {
              await sendEmail({
                to: ownerProfile.email,
                subject: `Bail automatiquement annulé — ${propertyLabel}`,
                html: `
                  <p>Bonjour ${ownerProfile.prenom || ""},</p>
                  <p>Le bail pour le bien situé au <strong>${propertyLabel}</strong> a été automatiquement annulé
                  car il n'a pas été activé dans les 30 jours suivant sa création.</p>
                  <p>Vous pouvez créer un nouveau bail à tout moment depuis votre espace propriétaire.</p>
                  <p>L'équipe Talok</p>
                `,
                tags: [{ name: "category", value: "lease_auto_cancelled" }],
              });
              results.notified++;
            } catch (emailError) {
              console.error("[CRON zombie-lease-cleanup] Email error:", emailError);
            }
          }
        }
      } catch (leaseError: unknown) {
        results.errors.push(
          `Lease ${leaseData.id}: ${leaseError instanceof Error ? leaseError.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      message: `Nettoyage terminé : ${results.cancelled} bail(s) annulé(s) sur ${results.processed} traité(s)`,
      ...results,
    });
  } catch (error: unknown) {
    console.error("[CRON zombie-lease-cleanup] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
