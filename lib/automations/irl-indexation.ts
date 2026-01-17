/**
 * Automation: Indexation IRL (Indice de Référence des Loyers)
 * 
 * Calcul automatique de la révision annuelle des loyers
 * selon l'indice IRL publié par l'INSEE.
 * 
 * Sources:
 * - INSEE: https://www.insee.fr/fr/statistiques/serie/001515333
 * - Service-Public: https://www.service-public.fr/particuliers/vosdroits/F1311
 * 
 * Formule:
 * Nouveau loyer = Loyer actuel × (Nouvel IRL / Ancien IRL)
 */

import { createServiceRoleClient } from "@/lib/server/service-role-client";

// Valeurs IRL historiques (Source: INSEE)
// Format: { "YYYY-QX": valeur }
// Q1 = T1 (janvier-mars), Q2 = T2 (avril-juin), etc.
export const IRL_VALUES: Record<string, number> = {
  // 2024
  "2024-Q4": 145.47, // Estimation novembre 2025
  "2024-Q3": 144.51,
  "2024-Q2": 143.89,
  "2024-Q1": 143.46,
  // 2023
  "2023-Q4": 142.06,
  "2023-Q3": 141.03,
  "2023-Q2": 140.59,
  "2023-Q1": 138.61,
  // 2022
  "2022-Q4": 137.26,
  "2022-Q3": 136.27,
  "2022-Q2": 135.84,
  "2022-Q1": 133.93,
  // 2021
  "2021-Q4": 132.62,
  "2021-Q3": 131.67,
  "2021-Q2": 131.12,
  "2021-Q1": 130.69,
  // 2020
  "2020-Q4": 130.52,
  "2020-Q3": 130.59,
  "2020-Q2": 130.57,
  "2020-Q1": 130.57,
};

export interface IRLCalculation {
  leaseId: string;
  currentRent: number;
  newRent: number;
  increase: number;
  increasePercent: number;
  oldIRL: {
    quarter: string;
    value: number;
  };
  newIRL: {
    quarter: string;
    value: number;
  };
  effectiveDate: Date;
  notificationSent: boolean;
}

export interface IRLProcessResult {
  processed: number;
  updated: number;
  skipped: number;
  calculations: IRLCalculation[];
  errors: string[];
}

/**
 * Obtenir le trimestre IRL pour une date donnée
 */
export function getIRLQuarter(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  if (month <= 3) return `${year}-Q1`;
  if (month <= 6) return `${year}-Q2`;
  if (month <= 9) return `${year}-Q3`;
  return `${year}-Q4`;
}

/**
 * Obtenir le trimestre IRL il y a un an
 */
export function getPreviousYearQuarter(quarter: string): string {
  const [year, q] = quarter.split("-");
  return `${parseInt(year) - 1}-${q}`;
}

/**
 * Calculer le nouveau loyer avec l'indexation IRL
 */
export function calculateNewRent(
  currentRent: number,
  oldIRLQuarter: string,
  newIRLQuarter: string
): { newRent: number; increase: number; increasePercent: number } {
  const oldIRL = IRL_VALUES[oldIRLQuarter];
  const newIRL = IRL_VALUES[newIRLQuarter];

  if (!oldIRL || !newIRL) {
    throw new Error(`Valeurs IRL non disponibles: ${oldIRLQuarter} ou ${newIRLQuarter}`);
  }

  // Formule: Nouveau loyer = Loyer actuel × (Nouvel IRL / Ancien IRL)
  const newRent = currentRent * (newIRL / oldIRL);
  const increase = newRent - currentRent;
  const increasePercent = (increase / currentRent) * 100;

  return {
    newRent: Math.round(newRent * 100) / 100, // Arrondir au centime
    increase: Math.round(increase * 100) / 100,
    increasePercent: Math.round(increasePercent * 100) / 100,
  };
}

/**
 * Traiter toutes les indexations IRL dues
 */
export async function processIRLIndexations(): Promise<IRLProcessResult> {
  const supabase = createServiceRoleClient();
  const errors: string[] = [];
  const calculations: IRLCalculation[] = [];
  let updated = 0;
  let skipped = 0;

  try {
    const today = new Date();
    const currentQuarter = getIRLQuarter(today);

    // Récupérer tous les baux actifs éligibles à l'indexation
    // Un bail est éligible si:
    // 1. Il est actif
    // 2. La date anniversaire est passée
    // 3. L'indexation n'a pas été faite cette année
    const { data: leases, error } = await supabase
      .from("leases")
      .select(`
        id,
        loyer,
        date_debut,
        type_bail,
        property:property_id (
          id,
          owner_id,
          adresse_complete
        ),
        signers:lease_signers (
          profile_id,
          role,
          profile:profile_id (
            prenom,
            nom,
            user_id,
            user:user_id (email)
          )
        )
      `)
      .eq("statut", "active")
      .in("type_bail", ["nu", "meuble"]); // Seuls nu et meublé sont indexables

    if (error) throw error;
    if (!leases || leases.length === 0) {
      return { processed: 0, updated: 0, skipped: 0, calculations: [], errors: [] };
    }

    for (const lease of leases) {
      try {
        const startDate = new Date(lease.date_debut);
        const anniversaryThisYear = new Date(
          today.getFullYear(),
          startDate.getMonth(),
          startDate.getDate()
        );

        // Vérifier si l'anniversaire est passé cette année
        if (anniversaryThisYear > today) {
          skipped++;
          continue;
        }

        // Vérifier si l'indexation a déjà été faite cette année
        const { data: existingIndexation } = await supabase
          .from("lease_indexations")
          .select("id")
          .eq("lease_id", lease.id)
          .gte("effective_date", `${today.getFullYear()}-01-01`)
          .maybeSingle();

        if (existingIndexation) {
          skipped++;
          continue;
        }

        // Calculer les trimestres IRL
        const newQuarter = currentQuarter;
        const oldQuarter = getPreviousYearQuarter(newQuarter);

        // Vérifier que les valeurs IRL sont disponibles
        if (!IRL_VALUES[oldQuarter] || !IRL_VALUES[newQuarter]) {
          errors.push(`IRL non disponible pour ${lease.id}: ${oldQuarter} ou ${newQuarter}`);
          skipped++;
          continue;
        }

        // Calculer le nouveau loyer
        const { newRent, increase, increasePercent } = calculateNewRent(
          lease.loyer,
          oldQuarter,
          newQuarter
        );

        // Créer l'enregistrement d'indexation
        const { error: insertError } = await supabase
          .from("lease_indexations")
          .insert({
            lease_id: lease.id,
            old_rent: lease.loyer,
            new_rent: newRent,
            old_irl_quarter: oldQuarter,
            old_irl_value: IRL_VALUES[oldQuarter],
            new_irl_quarter: newQuarter,
            new_irl_value: IRL_VALUES[newQuarter],
            increase_amount: increase,
            increase_percent: increasePercent,
            effective_date: anniversaryThisYear.toISOString().split("T")[0],
            status: "pending", // En attente de validation propriétaire
          });

        if (insertError) {
          errors.push(`Erreur insertion indexation ${lease.id}: ${insertError.message}`);
          continue;
        }

        // Notifier le propriétaire
        const property = lease.property as any;
        const ownerSigner = (lease.signers as any[])?.find(s => s.role === "proprietaire");
        const tenantSigner = (lease.signers as any[])?.find(s => s.role === "locataire_principal");

        if (property?.owner_id) {
          await supabase.from("notifications").insert({
            user_id: property.owner_id,
            type: "irl_indexation",
            title: "Révision de loyer disponible",
            body: `Le loyer du ${property.adresse_complete} peut être révisé de ${lease.loyer}€ à ${newRent}€ (+${increasePercent}%).`,
            priority: "medium",
            metadata: {
              lease_id: lease.id,
              old_rent: lease.loyer,
              new_rent: newRent,
              increase_percent: increasePercent,
            },
          });
        }

        calculations.push({
          leaseId: lease.id,
          currentRent: lease.loyer,
          newRent,
          increase,
          increasePercent,
          oldIRL: { quarter: oldQuarter, value: IRL_VALUES[oldQuarter] },
          newIRL: { quarter: newQuarter, value: IRL_VALUES[newQuarter] },
          effectiveDate: anniversaryThisYear,
          notificationSent: true,
        });

        updated++;
      } catch (err: any) {
        errors.push(`Erreur traitement bail ${lease.id}: ${err.message}`);
      }
    }

    return {
      processed: leases.length,
      updated,
      skipped,
      calculations,
      errors,
    };
  } catch (error: unknown) {
    errors.push(`Erreur globale: ${error.message}`);
    return { processed: 0, updated: 0, skipped: 0, calculations: [], errors };
  }
}

/**
 * Appliquer une indexation IRL validée par le propriétaire
 */
export async function applyIRLIndexation(
  indexationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  try {
    // Récupérer l'indexation
    const { data: indexation, error } = await supabase
      .from("lease_indexations")
      .select("*")
      .eq("id", indexationId)
      .single();

    if (error || !indexation) {
      return { success: false, error: "Indexation non trouvée" };
    }

    if (indexation.status !== "pending") {
      return { success: false, error: "Indexation déjà traitée" };
    }

    // Mettre à jour le loyer du bail
    const { error: updateError } = await supabase
      .from("leases")
      .update({ loyer: indexation.new_rent })
      .eq("id", indexation.lease_id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Marquer l'indexation comme appliquée
    await supabase
      .from("lease_indexations")
      .update({ status: "applied", applied_at: new Date().toISOString() })
      .eq("id", indexationId);

    // Notifier le locataire
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        signers:lease_signers (
          profile_id,
          role,
          profile:profile_id (user_id)
        )
      `)
      .eq("id", indexation.lease_id)
      .single();

    const tenantSigner = (lease?.signers as any[])?.find(
      s => s.role === "locataire_principal"
    );

    if (tenantSigner?.profile?.user_id) {
      await supabase.from("notifications").insert({
        user_id: tenantSigner.profile.user_id,
        type: "rent_increase",
        title: "Révision de votre loyer",
        body: `Votre loyer a été révisé de ${indexation.old_rent}€ à ${indexation.new_rent}€ suite à l'indexation IRL.`,
        priority: "high",
        metadata: {
          lease_id: indexation.lease_id,
          old_rent: indexation.old_rent,
          new_rent: indexation.new_rent,
          effective_date: indexation.effective_date,
        },
      });
    }

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error.message };
  }
}

