export const runtime = 'nodejs';

/**
 * GET /api/cron/check-insurance-expiry
 * Cron job pour détecter les polices d'assurance expirées ou proches de l'expiration
 * Configuré pour s'exécuter tous les lundis à 9h
 *
 * Obligations légales :
 * - Art. 7 Loi 89-462 : le locataire doit justifier d'une assurance habitation
 * - Le propriétaire peut résilier le bail si l'assurance n'est pas fournie après mise en demeure
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

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
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const results = {
    processed: 0,
    expired: 0,
    expiring_soon: 0,
    notifications_sent: 0,
    errors: [] as string[],
  };

  try {
    // 1. Trouver les polices expirées sur des baux actifs
    const { data: expiredPolicies, error: expiredError } = await supabase
      .from("insurance_policies")
      .select(`
        id,
        lease_id,
        policy_number,
        insurer_name,
        end_date,
        tenant_profile_id,
        reminder_sent,
        lease:leases!insurance_policies_lease_id_fkey (
          id,
          statut,
          property_id,
          properties:properties!leases_property_id_fkey (
            id,
            adresse_complete,
            owner_id,
            owner:profiles!properties_owner_id_fkey (
              id,
              user_id,
              prenom,
              nom
            )
          )
        ),
        tenant:profiles!insurance_policies_tenant_profile_id_fkey (
          id,
          user_id,
          prenom,
          nom
        )
      `)
      .lt("end_date", todayStr);

    if (expiredError) {
      throw new Error(`Erreur récupération polices expirées: ${expiredError.message}`);
    }

    // Traiter les polices expirées
    for (const policy of expiredPolicies || []) {
      try {
        const lease = policy.lease as any;
        if (!lease || lease.statut !== "active") continue;

        results.expired++;
        const owner = lease.properties?.owner;
        const tenant = policy.tenant as any;

        // Vérifier s'il existe une police plus récente valide
        const { data: validPolicy } = await supabase
          .from("insurance_policies")
          .select("id")
          .eq("lease_id", policy.lease_id)
          .gte("end_date", todayStr)
          .limit(1)
          .maybeSingle();

        if (validPolicy) continue; // Il y a déjà une police valide, ignorer

        // Notifier le propriétaire
        if (owner?.user_id) {
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", owner.user_id)
            .eq("type", "insurance_expired")
            .eq("data->lease_id", policy.lease_id)
            .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .maybeSingle();

          if (!existing) {
            await supabase.from("notifications").insert({
              user_id: owner.user_id,
              type: "insurance_expired",
              title: "Assurance habitation expirée",
              message: `L'assurance habitation de ${tenant?.prenom} ${tenant?.nom} pour ${lease.properties?.adresse_complete} a expiré le ${policy.end_date}. Demandez une nouvelle attestation.`,
              data: {
                lease_id: policy.lease_id,
                policy_id: policy.id,
                tenant_name: `${tenant?.prenom} ${tenant?.nom}`,
                expired_date: policy.end_date,
                severity: "critical",
              },
            });
            results.notifications_sent++;
          }
        }

        // Notifier le locataire
        if (tenant?.user_id) {
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", tenant.user_id)
            .eq("type", "insurance_renewal_required")
            .eq("data->policy_id", policy.id)
            .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .maybeSingle();

          if (!existing) {
            await supabase.from("notifications").insert({
              user_id: tenant.user_id,
              type: "insurance_renewal_required",
              title: "Votre assurance habitation a expiré",
              message: `Votre assurance habitation (${policy.insurer_name} - ${policy.policy_number}) a expiré le ${policy.end_date}. Veuillez fournir une nouvelle attestation à votre propriétaire (obligation Art. 7 Loi 89-462).`,
              data: {
                policy_id: policy.id,
                lease_id: policy.lease_id,
                expired_date: policy.end_date,
                severity: "critical",
              },
            });
            results.notifications_sent++;
          }
        }

        results.processed++;
      } catch (err: any) {
        results.errors.push(`Policy ${policy.id}: ${err.message}`);
      }
    }

    // 2. Trouver les polices qui expirent dans les 30 prochains jours
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: expiringPolicies } = await supabase
      .from("insurance_policies")
      .select(`
        id,
        lease_id,
        policy_number,
        insurer_name,
        end_date,
        reminder_sent,
        tenant_profile_id,
        tenant:profiles!insurance_policies_tenant_profile_id_fkey (
          id,
          user_id,
          prenom,
          nom
        )
      `)
      .gte("end_date", todayStr)
      .lte("end_date", thirtyDaysFromNow)
      .eq("reminder_sent", false);

    for (const policy of expiringPolicies || []) {
      try {
        // Vérifier que le bail est actif
        const { data: lease } = await supabase
          .from("leases")
          .select("id, statut")
          .eq("id", policy.lease_id)
          .eq("statut", "active")
          .maybeSingle();

        if (!lease) continue;

        const tenant = policy.tenant as any;
        if (tenant?.user_id) {
          await supabase.from("notifications").insert({
            user_id: tenant.user_id,
            type: "insurance_expiring_soon",
            title: "Assurance habitation : renouvellement à prévoir",
            message: `Votre assurance habitation (${policy.insurer_name}) expire le ${policy.end_date}. Pensez à la renouveler et à transmettre la nouvelle attestation.`,
            data: {
              policy_id: policy.id,
              lease_id: policy.lease_id,
              expiry_date: policy.end_date,
            },
          });
          results.notifications_sent++;
        }

        // Marquer le rappel comme envoyé
        await supabase
          .from("insurance_policies")
          .update({ reminder_sent: true })
          .eq("id", policy.id);

        results.expiring_soon++;
      } catch (err: any) {
        results.errors.push(`Expiring ${policy.id}: ${err.message}`);
      }
    }

    // 3. Baux actifs SANS aucune police d'assurance
    const { data: leasesWithoutInsurance } = await supabase
      .rpc("get_leases_without_insurance");

    // Fallback si le RPC n'existe pas: requête manuelle
    if (!leasesWithoutInsurance) {
      const { data: activeLeases } = await supabase
        .from("leases")
        .select(`
          id,
          property_id,
          properties:properties!leases_property_id_fkey (
            adresse_complete,
            owner_id,
            owner:profiles!properties_owner_id_fkey (user_id)
          )
        `)
        .eq("statut", "active");

      for (const lease of activeLeases || []) {
        const { count } = await supabase
          .from("insurance_policies")
          .select("id", { count: "exact", head: true })
          .eq("lease_id", lease.id);

        if (count === 0) {
          const owner = (lease as any).properties?.owner;
          if (owner?.user_id) {
            // Notifier max 1 fois par mois
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", owner.user_id)
              .eq("type", "insurance_missing")
              .eq("data->lease_id", lease.id)
              .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
              .maybeSingle();

            if (!existing) {
              await supabase.from("notifications").insert({
                user_id: owner.user_id,
                type: "insurance_missing",
                title: "Assurance habitation manquante",
                message: `Aucune attestation d'assurance n'est enregistrée pour le bail à ${(lease as any).properties?.adresse_complete}. Demandez-la au locataire.`,
                data: {
                  lease_id: lease.id,
                  severity: "warning",
                },
              });
              results.notifications_sent++;
            }
          }
        }
      }
    }

    // Log
    await supabase.from("audit_log").insert({
      action: "cron_check_insurance_expiry",
      entity_type: "cron",
      metadata: {
        ...results,
        executed_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `${results.expired} polices expirées, ${results.expiring_soon} expirant bientôt, ${results.notifications_sent} notifications envoyées`,
      ...results,
    });
  } catch (error: unknown) {
    console.error("Erreur cron check-insurance-expiry:", error);

    await supabase.from("audit_log").insert({
      action: "cron_check_insurance_expiry_error",
      entity_type: "cron",
      metadata: {
        error: error instanceof Error ? error.message : "Erreur",
        executed_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur", ...results },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
