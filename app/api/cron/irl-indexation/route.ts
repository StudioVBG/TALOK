export const runtime = 'nodejs';

/**
 * GET /api/cron/irl-indexation
 * Cron job pour calculer et notifier les indexations IRL annuelles
 * Configuré pour s'exécuter le 1er de chaque mois
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Vérifier le secret CRON
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    console.warn("CRON_SECRET non configuré - accès autorisé en dev");
    return process.env.NODE_ENV === "development";
  }
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// Indices IRL par trimestre (source: INSEE)
// Format: "YYYY-TQ" => valeur
const IRL_VALUES: Record<string, number> = {
  "2024-T1": 143.46,
  "2024-T2": 144.42,
  "2024-T3": 144.51,
  "2024-T4": 145.47,
  "2023-T1": 138.61,
  "2023-T2": 140.59,
  "2023-T3": 141.03,
  "2023-T4": 142.06,
  "2022-T1": 133.93,
  "2022-T2": 135.84,
  "2022-T3": 136.27,
  "2022-T4": 137.26,
};

function getCurrentIRL(): { key: string; value: number } {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  
  // Chercher le dernier IRL disponible
  for (let y = year; y >= year - 2; y--) {
    for (let q = quarter; q >= 1; q--) {
      const key = `${y}-T${q}`;
      if (IRL_VALUES[key]) {
        return { key, value: IRL_VALUES[key] };
      }
    }
  }
  
  // Fallback
  return { key: "2024-T4", value: 145.47 };
}

function getIRLForDate(date: Date): { key: string; value: number } {
  const year = date.getFullYear();
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  
  for (let y = year; y >= year - 2; y--) {
    for (let q = 4; q >= 1; q--) {
      const key = `${y}-T${q}`;
      if (IRL_VALUES[key]) {
        return { key, value: IRL_VALUES[key] };
      }
    }
  }
  
  return { key: "2023-T4", value: 142.06 };
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const results = {
    processed: 0,
    indexations_calculated: 0,
    notifications_sent: 0,
    errors: [] as string[],
  };

  try {
    // Récupérer tous les baux actifs qui ont une date de révision ce mois
    const { data: leases, error: fetchError } = await supabase
      .from("leases")
      .select(`
        id,
        loyer,
        charges_forfaitaires,
        date_debut,
        dernier_irl_reference,
        derniere_revision,
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
      .not("loyer", "is", null);

    if (fetchError) {
      throw new Error(`Erreur récupération baux: ${fetchError.message}`);
    }

    if (!leases || leases.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Aucun bail actif à indexer",
        ...results,
      });
    }

    const currentIRL = getCurrentIRL();

    for (const lease of leases) {
      try {
        // Vérifier si le bail est éligible à la révision ce mois
        const startDate = new Date(lease.date_debut);
        const startMonth = startDate.getMonth() + 1;
        
        // La révision a lieu à la date anniversaire
        if (startMonth !== currentMonth) {
          continue; // Pas le mois de révision
        }

        // Vérifier si déjà révisé cette année
        if (lease.derniere_revision) {
          const lastRevision = new Date(lease.derniere_revision);
          if (
            lastRevision.getFullYear() === currentYear &&
            lastRevision.getMonth() + 1 === currentMonth
          ) {
            continue; // Déjà révisé ce mois
          }
        }

        // Calculer l'indexation
        const oldRent = lease.loyer;
        const referenceIRL = lease.dernier_irl_reference 
          ? getIRLForDate(new Date(lease.date_debut))
          : getIRLForDate(new Date(startDate.setFullYear(startDate.getFullYear() - 1)));
        
        // Formule: Nouveau loyer = Loyer actuel × (IRL actuel / IRL de référence)
        const newRent = Math.round(
          (oldRent * currentIRL.value / referenceIRL.value) * 100
        ) / 100;
        
        const increase = newRent - oldRent;
        const increasePercent = ((increase / oldRent) * 100).toFixed(2);

        // Ne pas appliquer automatiquement, juste notifier
        // L'application se fait manuellement par le propriétaire

        // Trouver le propriétaire
        const owner = lease.owner?.[0]?.owner;
        if (!owner) {
          results.errors.push(`Bail ${lease.id}: Propriétaire non trouvé`);
          continue;
        }

        // Créer un enregistrement d'indexation (proposition)
        const { data: indexation, error: indexError } = await supabase
          .from("lease_indexations")
          .insert({
            lease_id: lease.id,
            indexation_date: today.toISOString().split("T")[0],
            old_rent: oldRent,
            new_rent: newRent,
            irl_value: currentIRL.value,
            irl_reference: referenceIRL.value,
            irl_period: currentIRL.key,
            status: "pending", // En attente de validation propriétaire
          })
          .select()
          .single();

        if (indexError) {
          // Peut échouer si déjà existe (unique constraint)
          if (!indexError.message.includes("duplicate")) {
            results.errors.push(`Bail ${lease.id}: ${indexError.message}`);
          }
          continue;
        }

        results.indexations_calculated++;

        // Notifier le propriétaire
        await supabase.from("notifications").insert({
          user_id: owner.user_id,
          type: "irl_indexation_available",
          title: "Révision de loyer disponible",
          message: `Le bail de ${lease.property.adresse_complete} peut être révisé. Nouveau loyer proposé: ${newRent.toFixed(2)}€ (+${increasePercent}%).`,
          data: {
            lease_id: lease.id,
            indexation_id: indexation?.id,
            old_rent: oldRent,
            new_rent: newRent,
            increase: increase.toFixed(2),
            increase_percent: increasePercent,
            irl_current: currentIRL.key,
            irl_value: currentIRL.value,
          },
        });

        results.notifications_sent++;
        results.processed++;
      } catch (leaseError: any) {
        results.errors.push(`Bail ${lease.id}: ${leaseError.message}`);
      }
    }

    // Log du résultat
    await supabase.from("audit_log").insert({
      action: "cron_irl_indexation",
      entity_type: "cron",
      metadata: {
        ...results,
        executed_at: new Date().toISOString(),
        total_leases: leases.length,
        current_irl: currentIRL,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${results.indexations_calculated} indexations calculées`,
      current_irl: currentIRL,
      ...results,
    });
  } catch (error: any) {
    console.error("Erreur cron irl-indexation:", error);

    await supabase.from("audit_log").insert({
      action: "cron_irl_indexation_error",
      entity_type: "cron",
      metadata: {
        error: error.message,
        executed_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        ...results,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
