export const runtime = 'nodejs';

/**
 * GET /api/cron/auto-renew-leases
 * Cron job pour la reconduction tacite automatique des baux
 * Configuré pour s'exécuter le 1er de chaque mois à 6h
 *
 * Droit français :
 * - Bail nu (Art. 10 Loi 89-462) : reconduction tacite pour même durée (3 ans PP / 6 ans PM)
 * - Bail meublé (Art. 25-8) : reconduction tacite pour 1 an
 * - Bail étudiant : PAS de reconduction tacite (9 mois)
 * - Bail mobilité : PAS de reconduction tacite (max 10 mois, Art. 25-12 ELAN)
 * - Bail saisonnier : PAS de reconduction tacite
 *
 * Préavis propriétaire : 6 mois avant échéance (bail nu) / 3 mois (bail meublé)
 * Préavis locataire : 3 mois (bail nu) / 1 mois (bail meublé, zone tendue)
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { addMonths, addYears, format, differenceInMonths } from "date-fns";
import { fr } from "date-fns/locale";

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return process.env.NODE_ENV === "development";
  }
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// Durées de reconduction par type de bail
const RENEWAL_CONFIG: Record<string, {
  can_renew: boolean;
  duration_months_pp: number; // Personne physique
  duration_months_pm: number; // Personne morale
  owner_notice_months: number;
  tenant_notice_months: number;
}> = {
  nu: { can_renew: true, duration_months_pp: 36, duration_months_pm: 72, owner_notice_months: 6, tenant_notice_months: 3 },
  meuble: { can_renew: true, duration_months_pp: 12, duration_months_pm: 12, owner_notice_months: 3, tenant_notice_months: 1 },
  colocation: { can_renew: true, duration_months_pp: 12, duration_months_pm: 12, owner_notice_months: 3, tenant_notice_months: 1 },
  bail_mixte: { can_renew: true, duration_months_pp: 36, duration_months_pm: 72, owner_notice_months: 6, tenant_notice_months: 3 },
  // Non renouvelables
  etudiant: { can_renew: false, duration_months_pp: 0, duration_months_pm: 0, owner_notice_months: 0, tenant_notice_months: 0 },
  bail_mobilite: { can_renew: false, duration_months_pp: 0, duration_months_pm: 0, owner_notice_months: 0, tenant_notice_months: 0 },
  saisonnier: { can_renew: false, duration_months_pp: 0, duration_months_pm: 0, owner_notice_months: 0, tenant_notice_months: 0 },
  // Commerciaux (gérés différemment)
  commercial_3_6_9: { can_renew: true, duration_months_pp: 108, duration_months_pm: 108, owner_notice_months: 6, tenant_notice_months: 6 },
  commercial_derogatoire: { can_renew: false, duration_months_pp: 0, duration_months_pm: 0, owner_notice_months: 0, tenant_notice_months: 0 },
  professionnel: { can_renew: true, duration_months_pp: 72, duration_months_pm: 72, owner_notice_months: 6, tenant_notice_months: 6 },
};

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const results = {
    processed: 0,
    renewed: 0,
    pre_notifications_sent: 0,
    non_renewable: 0,
    already_notified: 0,
    errors: [] as string[],
  };

  try {
    // 1. Reconduction tacite : baux actifs arrivant à échéance dans les 7 prochains jours
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: expiringLeases, error: fetchError } = await supabase
      .from("leases")
      .select(`
        id,
        type_bail,
        date_debut,
        date_fin,
        tacite_reconduction,
        loyer,
        property:properties!leases_property_id_fkey (
          id,
          adresse_complete,
          owner_id,
          legal_entity_id,
          owner:profiles!properties_owner_id_fkey (
            id, user_id, prenom, nom
          )
        ),
        signers:lease_signers (
          profile_id,
          role,
          profile:profiles!lease_signers_profile_id_fkey (
            id, user_id, prenom, nom
          )
        )
      `)
      .eq("statut", "active")
      .not("date_fin", "is", null)
      .gte("date_fin", todayStr)
      .lte("date_fin", sevenDaysFromNow);

    if (fetchError) {
      throw new Error(`Erreur récupération baux: ${fetchError.message}`);
    }

    for (const lease of expiringLeases || []) {
      try {
        results.processed++;
        const typeBail = lease.type_bail || "nu";
        const config = RENEWAL_CONFIG[typeBail];

        if (!config || !config.can_renew) {
          results.non_renewable++;
          continue;
        }

        // Vérifier si tacite_reconduction est explicitement désactivée
        if (lease.tacite_reconduction === false) {
          results.non_renewable++;
          continue;
        }

        // Vérifier qu'il n'y a pas de congé en cours (departure_notices)
        const { data: activeNotice } = await supabase
          .from("departure_notices")
          .select("id")
          .eq("lease_id", lease.id)
          .in("status", ["sent", "acknowledged"])
          .maybeSingle();

        if (activeNotice) {
          continue; // Congé en cours, pas de reconduction
        }

        // Déterminer si le propriétaire est une personne morale
        const property = lease.property as any;
        const isLegalEntity = !!property?.legal_entity_id;
        const renewalMonths = isLegalEntity
          ? config.duration_months_pm
          : config.duration_months_pp;

        // Calculer la nouvelle date de fin
        const currentEndDate = new Date(lease.date_fin as string);
        const newEndDate = addMonths(currentEndDate, renewalMonths);

        // Prolonger le bail
        const { error: updateError } = await supabase
          .from("leases")
          .update({
            date_fin: newEndDate.toISOString().split("T")[0],
            updated_at: new Date().toISOString(),
            metadata: {
              last_renewal: {
                date: todayStr,
                previous_end: lease.date_fin,
                new_end: newEndDate.toISOString().split("T")[0],
                type: "tacite_reconduction",
                duration_months: renewalMonths,
              },
            },
          } as any)
          .eq("id", lease.id);

        if (updateError) {
          results.errors.push(`Bail ${lease.id}: ${updateError.message}`);
          continue;
        }

        results.renewed++;

        // Notifier le propriétaire
        const owner = property?.owner;
        if (owner?.user_id) {
          await supabase.from("notifications").insert({
            user_id: owner.user_id,
            type: "lease_tacit_renewal",
            title: "Bail reconduit tacitement",
            message: `Le bail à ${property?.adresse_complete} a été reconduit tacitement jusqu'au ${format(newEndDate, "d MMMM yyyy", { locale: fr })} (${renewalMonths} mois).`,
            data: {
              lease_id: lease.id,
              previous_end: lease.date_fin,
              new_end: newEndDate.toISOString().split("T")[0],
              renewal_months: renewalMonths,
            },
          });
        }

        // Notifier le locataire principal
        const tenant = (lease.signers as any[])?.find(
          (s) => ["locataire_principal", "locataire", "tenant", "principal"].includes(s.role)
        )?.profile;
        if (tenant?.user_id) {
          await supabase.from("notifications").insert({
            user_id: tenant.user_id,
            type: "lease_tacit_renewal",
            title: "Votre bail a été reconduit",
            message: `Votre bail à ${property?.adresse_complete} a été reconduit tacitement jusqu'au ${format(newEndDate, "d MMMM yyyy", { locale: fr })}.`,
            data: {
              lease_id: lease.id,
              new_end: newEndDate.toISOString().split("T")[0],
            },
          });
        }

        // Outbox event
        await supabase.from("outbox").insert({
          event_type: "Lease.TacitRenewal",
          aggregate_id: lease.id,
          payload: {
            lease_id: lease.id,
            previous_end: lease.date_fin,
            new_end: newEndDate.toISOString().split("T")[0],
            renewal_months: renewalMonths,
            type_bail: typeBail,
          },
        });

        // Audit log
        await supabase.from("audit_log").insert({
          action: "lease_tacit_renewal",
          entity_type: "lease",
          entity_id: lease.id,
          metadata: {
            previous_end: lease.date_fin,
            new_end: newEndDate.toISOString().split("T")[0],
            renewal_months: renewalMonths,
            is_legal_entity: isLegalEntity,
          },
        });
      } catch (err: any) {
        results.errors.push(`Bail ${lease.id}: ${err.message}`);
      }
    }

    // 2. Pré-notifications : baux expirant dans 6 mois (proprio) et 3 mois (locataire)
    for (const noticeMonths of [6, 3]) {
      const targetDate = addMonths(today, noticeMonths);
      const targetStart = new Date(targetDate);
      targetStart.setDate(1);
      const targetEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

      const { data: upcomingLeases } = await supabase
        .from("leases")
        .select(`
          id,
          type_bail,
          date_fin,
          tacite_reconduction,
          property:properties!leases_property_id_fkey (
            adresse_complete,
            owner_id,
            owner:profiles!properties_owner_id_fkey (id, user_id, prenom, nom)
          ),
          signers:lease_signers (
            role,
            profile:profiles!lease_signers_profile_id_fkey (id, user_id, prenom, nom)
          )
        `)
        .eq("statut", "active")
        .not("date_fin", "is", null)
        .gte("date_fin", targetStart.toISOString().split("T")[0])
        .lte("date_fin", targetEnd.toISOString().split("T")[0]);

      for (const lease of upcomingLeases || []) {
        const config = RENEWAL_CONFIG[lease.type_bail || "nu"];
        if (!config) continue;

        const property = lease.property as any;
        const tenant = (lease.signers as any[])?.find(
          (s) => ["locataire_principal", "locataire", "tenant", "principal"].includes(s.role)
        )?.profile;

        const endFormatted = format(new Date(lease.date_fin as string), "d MMMM yyyy", { locale: fr });

        // 6 mois : notifier le propriétaire (pour bail nu: préavis de 6 mois)
        if (noticeMonths === 6 && config.owner_notice_months >= 6 && property?.owner?.user_id) {
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", property.owner.user_id)
            .eq("type", "lease_pre_expiry_owner")
            .eq("data->lease_id", lease.id)
            .eq("data->notice_months", 6)
            .maybeSingle();

          if (!existing) {
            await supabase.from("notifications").insert({
              user_id: property.owner.user_id,
              type: "lease_pre_expiry_owner",
              title: "Bail : échéance dans 6 mois",
              message: `Le bail à ${property?.adresse_complete} arrive à échéance le ${endFormatted}. ${lease.tacite_reconduction !== false ? "Il sera reconduit tacitement sauf congé donné." : "Pas de reconduction tacite prévue."} Le préavis propriétaire est de ${config.owner_notice_months} mois.`,
              data: {
                lease_id: lease.id,
                end_date: lease.date_fin,
                notice_months: 6,
                tacite_reconduction: lease.tacite_reconduction,
              },
            });
            results.pre_notifications_sent++;
          }
        }

        // 3 mois : notifier le locataire
        if (noticeMonths === 3 && tenant?.user_id) {
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", tenant.user_id)
            .eq("type", "lease_pre_expiry_tenant")
            .eq("data->lease_id", lease.id)
            .eq("data->notice_months", 3)
            .maybeSingle();

          if (!existing) {
            await supabase.from("notifications").insert({
              user_id: tenant.user_id,
              type: "lease_pre_expiry_tenant",
              title: "Votre bail arrive à échéance dans 3 mois",
              message: `Votre bail à ${property?.adresse_complete} arrive à échéance le ${endFormatted}. ${lease.tacite_reconduction !== false ? "Il sera reconduit tacitement." : "Il ne sera pas reconduit automatiquement."} Votre préavis est de ${config.tenant_notice_months} mois.`,
              data: {
                lease_id: lease.id,
                end_date: lease.date_fin,
                notice_months: 3,
              },
            });
            results.pre_notifications_sent++;
          }
        }
      }
    }

    // Log final
    await supabase.from("audit_log").insert({
      action: "cron_auto_renew_leases",
      entity_type: "cron",
      metadata: {
        ...results,
        executed_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `${results.renewed} baux reconduits, ${results.pre_notifications_sent} pré-notifications envoyées`,
      ...results,
    });
  } catch (error: unknown) {
    console.error("Erreur cron auto-renew-leases:", error);

    await supabase.from("audit_log").insert({
      action: "cron_auto_renew_leases_error",
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
