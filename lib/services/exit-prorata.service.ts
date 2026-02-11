/**
 * SOTA 2026 — Service de calcul du prorata de sortie
 *
 * Calcule le loyer et les charges au prorata lorsqu'un bail se termine
 * en cours de mois. Génère la facture finale ajustée.
 *
 * Base légale : Le locataire ne doit payer que les jours d'occupation
 * réels du dernier mois (Art. 15 III loi 89-462).
 */

import { type SupabaseClient } from "@supabase/supabase-js";

// ============================================
// TYPES
// ============================================

export interface ExitProrataInput {
  leaseId: string;
  exitDate: string;          // YYYY-MM-DD — date effective de sortie
  monthlyRent: number;       // Loyer HC mensuel
  monthlyCharges: number;    // Charges mensuelles
  chargesType: "forfait" | "provisions";
}

export interface ExitProrataResult {
  exitDate: string;
  daysInMonth: number;
  occupiedDays: number;
  prorataRatio: number;       // occupiedDays / daysInMonth
  proratedRent: number;       // Loyer proratisé
  proratedCharges: number;    // Charges proratisées
  totalDue: number;           // Total dû pour le dernier mois
  fullMonthTotal: number;     // Total d'un mois complet (pour référence)
  savings: number;            // Différence (ce que le locataire économise)
  isProrated: boolean;        // false si sortie le dernier jour du mois
  period: string;             // YYYY-MM
}

export interface FinalInvoiceResult {
  success: boolean;
  invoice_id?: string;
  prorata: ExitProrataResult;
  error?: string;
}

// ============================================
// CALCUL
// ============================================

/**
 * Calcule le prorata de sortie pour un bail qui se termine en cours de mois.
 */
export function calculateExitProrata(input: ExitProrataInput): ExitProrataResult {
  const exitDate = new Date(input.exitDate);
  const year = exitDate.getFullYear();
  const month = exitDate.getMonth();
  const dayOfMonth = exitDate.getDate();

  // Nombre de jours dans le mois de sortie
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Le locataire occupe du 1er au jour de sortie inclus
  const occupiedDays = dayOfMonth;

  // Vérifier si c'est le dernier jour du mois (pas de prorata)
  const isLastDay = dayOfMonth === daysInMonth;
  const isProrated = !isLastDay;

  const prorataRatio = isProrated ? occupiedDays / daysInMonth : 1;

  const proratedRent = Math.round(input.monthlyRent * prorataRatio * 100) / 100;
  const proratedCharges = Math.round(input.monthlyCharges * prorataRatio * 100) / 100;
  const totalDue = Math.round((proratedRent + proratedCharges) * 100) / 100;
  const fullMonthTotal = input.monthlyRent + input.monthlyCharges;

  return {
    exitDate: input.exitDate,
    daysInMonth,
    occupiedDays,
    prorataRatio: Math.round(prorataRatio * 10000) / 10000,
    proratedRent,
    proratedCharges,
    totalDue,
    fullMonthTotal,
    savings: Math.round((fullMonthTotal - totalDue) * 100) / 100,
    isProrated,
    period: `${year}-${String(month + 1).padStart(2, "0")}`,
  };
}

// ============================================
// SERVICE
// ============================================

/**
 * Génère la facture finale proratisée pour un bail en fin de vie.
 */
export async function generateFinalInvoice(
  supabase: SupabaseClient,
  leaseId: string,
  exitDate: string,
  actorUserId: string
): Promise<FinalInvoiceResult> {
  // 1. Récupérer le bail avec ses données financières
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select(`
      id, loyer, charges_forfaitaires, charges_type, statut,
      property:properties!leases_property_id_fkey(owner_id),
      signers:lease_signers(profile_id, role)
    `)
    .eq("id", leaseId)
    .single();

  if (leaseError || !lease) {
    return { success: false, prorata: {} as ExitProrataResult, error: "Bail non trouvé" };
  }

  // 2. Calculer le prorata
  const prorata = calculateExitProrata({
    leaseId,
    exitDate,
    monthlyRent: lease.loyer || 0,
    monthlyCharges: lease.charges_forfaitaires || 0,
    chargesType: (lease.charges_type as "forfait" | "provisions") || "forfait",
  });

  // 3. Identifier les acteurs
  const ownerId = (lease as any).property?.owner_id;
  const tenantRoles = ["locataire_principal", "locataire", "tenant", "principal"];
  const tenantSigner = (lease as any).signers?.find((s: any) =>
    tenantRoles.includes(s.role)
  );

  if (!ownerId || !tenantSigner?.profile_id) {
    return { success: false, prorata, error: "Propriétaire ou locataire introuvable" };
  }

  // 4. Vérifier qu'une facture pour cette période n'existe pas déjà
  const { data: existingInvoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("lease_id", leaseId)
    .eq("periode", prorata.period)
    .maybeSingle();

  if (existingInvoice) {
    // Mettre à jour la facture existante avec les montants proratisés
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        montant_loyer: prorata.proratedRent,
        montant_charges: prorata.proratedCharges,
        montant_total: prorata.totalDue,
        metadata: {
          type: "final_invoice",
          is_prorated: prorata.isProrated,
          exit_date: exitDate,
          occupied_days: prorata.occupiedDays,
          days_in_month: prorata.daysInMonth,
          prorata_ratio: prorata.prorataRatio,
          version: "SOTA-2026",
        },
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", existingInvoice.id);

    if (updateError) {
      return { success: false, prorata, error: updateError.message };
    }

    return { success: true, invoice_id: existingInvoice.id, prorata };
  }

  // 5. Créer la facture finale
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      lease_id: leaseId,
      owner_id: ownerId,
      tenant_id: tenantSigner.profile_id,
      periode: prorata.period,
      montant_loyer: prorata.proratedRent,
      montant_charges: prorata.proratedCharges,
      montant_total: prorata.totalDue,
      statut: "sent",
      metadata: {
        type: "final_invoice",
        is_prorated: prorata.isProrated,
        exit_date: exitDate,
        occupied_days: prorata.occupiedDays,
        days_in_month: prorata.daysInMonth,
        prorata_ratio: prorata.prorataRatio,
        original_rent: lease.loyer,
        original_charges: lease.charges_forfaitaires,
        savings: prorata.savings,
        version: "SOTA-2026",
      },
    } as any)
    .select("id")
    .single();

  if (invoiceError) {
    return { success: false, prorata, error: invoiceError.message };
  }

  // 6. Audit
  await supabase.from("audit_log").insert({
    user_id: actorUserId,
    action: "final_invoice_generated",
    entity_type: "invoice",
    entity_id: invoice.id,
    metadata: {
      lease_id: leaseId,
      exit_date: exitDate,
      prorated: prorata.isProrated,
      total_due: prorata.totalDue,
      savings: prorata.savings,
    },
  } as any);

  // 7. Outbox event
  await supabase.from("outbox").insert({
    event_type: "Invoice.FinalGenerated",
    payload: {
      lease_id: leaseId,
      invoice_id: invoice.id,
      exit_date: exitDate,
      total_due: prorata.totalDue,
      is_prorated: prorata.isProrated,
    },
  } as any);

  return { success: true, invoice_id: invoice.id, prorata };
}
