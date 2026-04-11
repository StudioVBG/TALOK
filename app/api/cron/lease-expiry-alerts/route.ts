export const runtime = 'nodejs';

/**
 * GET /api/cron/lease-expiry-alerts
 * Cron job pour alerter des baux arrivant à expiration
 * Configuré pour s'exécuter tous les lundis à 8h
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { addDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

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

  // Périodes d'alerte : 90, 60, 30, 15, 7 jours avant expiration
  const alertPeriods = [90, 60, 30, 15, 7];

  const results = {
    processed: 0,
    alerts_sent: 0,
    expiring_soon: 0,
    errors: [] as string[],
  };

  try {
    // Récupérer les baux avec date de fin dans les 90 prochains jours
    const ninetyDaysFromNow = addDays(today, 90);

    const { data: leases, error: fetchError } = await supabase
      .from("leases")
      .select(`
        id,
        date_debut,
        date_fin,
        type_bail,
        loyer,
        property:properties(
          id,
          adresse_complete,
          owner_id
        ),
        owner:properties!inner(
          owner:profiles!properties_owner_id_fkey(
            id, prenom, nom, user_id
          )
        ),
        signers:lease_signers(
          profile:profiles(id, prenom, nom, user_id),
          role
        )
      `)
      .eq("statut", "active")
      .not("date_fin", "is", null)
      .lte("date_fin", ninetyDaysFromNow.toISOString().split("T")[0])
      .gte("date_fin", today.toISOString().split("T")[0]);

    if (fetchError) {
      throw new Error(`Erreur récupération baux: ${fetchError.message}`);
    }

    if (!leases || leases.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Aucun bail expirant prochainement",
        ...results,
      });
    }

    for (const lease of leases) {
      try {
        const endDate = new Date(lease.date_fin as string);
        const daysUntilExpiry = differenceInDays(endDate, today);
        results.expiring_soon++;

        // Trouver la période d'alerte correspondante
        const alertPeriod = alertPeriods.find((p) => {
          // Alerter si on est exactement à cette période ± 3 jours
          return Math.abs(daysUntilExpiry - p) <= 3;
        });

        if (!alertPeriod) {
          continue; // Pas dans une période d'alerte
        }

        const owner = (lease.owner as any)?.[0]?.owner;
        if (!owner) {
          results.errors.push(`Bail ${lease.id}: Propriétaire non trouvé`);
          continue;
        }

        // Vérifier si on a déjà envoyé cette alerte
        const { data: existingAlert } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", owner.user_id)
          .eq("type", "lease_expiry_alert")
          .eq("data->lease_id", lease.id)
          .eq("data->alert_period", alertPeriod)
          .single();

        if (existingAlert) {
          continue; // Déjà alerté pour cette période
        }

        // Trouver le locataire principal
        const mainTenant = lease.signers?.find(
          (s: any) => s.role === "locataire_principal"
        )?.profile;

        const formattedEndDate = format(endDate, "d MMMM yyyy", { locale: fr });

        // Envoyer l'alerte au propriétaire
        await supabase.from("notifications").insert({
          user_id: owner.user_id,
          type: "lease_expiry_alert",
          title: daysUntilExpiry <= 15 
            ? "⚠️ Bail expire très bientôt"
            : "📅 Bail à renouveler",
          message: `Le bail de ${lease.property!.adresse_complete} ${
            mainTenant ? `(${mainTenant.prenom} ${mainTenant.nom})` : ""
          } expire le ${formattedEndDate} (dans ${daysUntilExpiry} jours).`,
          data: {
            lease_id: lease.id,
            property_id: lease.property!.id,
            end_date: lease.date_fin,
            days_until_expiry: daysUntilExpiry,
            alert_period: alertPeriod,
            tenant_name: mainTenant 
              ? `${mainTenant.prenom} ${mainTenant.nom}` 
              : null,
          },
        });

        // Si très proche (<=30j), alerter aussi le locataire
        if (daysUntilExpiry <= 30 && mainTenant?.user_id) {
          await supabase.from("notifications").insert({
            user_id: mainTenant.user_id,
            type: "lease_expiry_tenant_alert",
            title: "Votre bail arrive à échéance",
            message: `Votre bail pour ${lease.property!.adresse_complete} expire le ${formattedEndDate}. Contactez votre propriétaire pour discuter du renouvellement.`,
            data: {
              lease_id: lease.id,
              end_date: lease.date_fin,
              days_until_expiry: daysUntilExpiry,
            },
          });
        }

        results.alerts_sent++;
        results.processed++;
      } catch (leaseError: any) {
        results.errors.push(`Bail ${lease.id}: ${leaseError.message}`);
      }
    }

    // Log du résultat
    await supabase.from("audit_log").insert({
      action: "cron_lease_expiry_alerts",
      entity_type: "cron",
      metadata: {
        ...results,
        executed_at: new Date().toISOString(),
        total_expiring: leases.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${results.alerts_sent} alertes envoyées`,
      ...results,
    });
  } catch (error: unknown) {
    console.error("Erreur cron lease-expiry-alerts:", error);

    await supabase.from("audit_log").insert({
      action: "cron_lease_expiry_alerts_error",
      entity_type: "cron",
      metadata: {
        error: extractErrorMessage(error),
        executed_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: extractErrorMessage(error),
        ...results,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}

