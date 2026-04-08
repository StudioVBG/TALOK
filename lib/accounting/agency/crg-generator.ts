/**
 * CRG Generator — Compte Rendu de Gestion (Agency Management Report)
 *
 * Generates legally-required management reports per mandant (Loi Hoguet Art. 6).
 * Covers 6 sections:
 *   1. Loyers par bien par mois
 *   2. Charges par categorie
 *   3. Honoraires (commission breakdown)
 *   4. Net reverse au mandant
 *   5. Impayes (locataires en retard)
 *   6. Travaux (factures prestataires)
 *
 * All amounts in integer cents. Never floating-point.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CRGSection1Item {
  propertyId: string;
  propertyAddress: string;
  month: string; // YYYY-MM
  loyerCents: number;
  chargesCents: number;
  totalCents: number;
}

export interface CRGSection2Item {
  category: string;
  label: string;
  amountCents: number;
}

export interface CRGSection3Item {
  label: string;
  baseCents: number;
  rate: number;
  commissionCents: number;
}

export interface CRGSection4Summary {
  totalLoyersCents: number;
  totalChargesCents: number;
  totalHonorairesCents: number;
  totalTravauxCents: number;
  netReverseCents: number;
  alreadyReversedCents: number;
  remainingToReverseCents: number;
}

export interface CRGSection5Item {
  tenantName: string;
  propertyAddress: string;
  amountDueCents: number;
  daysPastDue: number;
}

export interface CRGSection6Item {
  providerName: string;
  description: string;
  invoiceRef: string | null;
  amountCents: number;
  date: string;
}

export interface CRGData {
  id: string;
  mandantId: string;
  mandantName: string;
  agencyEntityId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  section1_loyers: CRGSection1Item[];
  section2_charges: CRGSection2Item[];
  section3_honoraires: CRGSection3Item[];
  section4_summary: CRGSection4Summary;
  section5_impayes: CRGSection5Item[];
  section6_travaux: CRGSection6Item[];
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a CRG for a specific mandant and period.
 *
 * 1. Load mandant + properties + entries for period
 * 2. Calculate: loyers collectes, charges reglees, honoraires preleves, net reverse, impayes
 * 3. Build CRG data with 6 sections
 * 4. Insert crg_reports
 *
 * @returns The full CRG data object with the inserted report ID
 */
export async function generateCRG(
  supabase: SupabaseClient,
  mandantId: string,
  periodStart: string,
  periodEnd: string,
): Promise<CRGData> {
  // -------------------------------------------------------------------------
  // 1. Load mandant
  // -------------------------------------------------------------------------

  const { data: mandant, error: mandantError } = await supabase
    .from("mandant_accounts")
    .select("*")
    .eq("id", mandantId)
    .single();

  if (mandantError || !mandant) {
    throw new Error(`Mandant non trouve: ${mandantError?.message ?? mandantId}`);
  }

  const entityId = mandant.entity_id as string;
  const accountNumber = mandant.sub_account_number as string;
  const commissionRate = mandant.commission_rate as number;
  const mandantName = mandant.mandant_name as string;

  // -------------------------------------------------------------------------
  // 2. Load properties for the mandant's owner
  // -------------------------------------------------------------------------

  const { data: properties } = await supabase
    .from("properties")
    .select("id, address, city, property_type")
    .eq("owner_entity_id", mandant.owner_entity_id);

  const propertyMap = new Map(
    (properties ?? []).map((p: { id: string; address: string; city: string }) => [
      p.id,
      `${p.address}, ${p.city}`,
    ]),
  );

  // -------------------------------------------------------------------------
  // 3. Load accounting entries for the period
  // -------------------------------------------------------------------------

  // Loyer entries (source = auto:agency_loyer_mandant)
  const { data: loyerLines } = await supabase
    .from("accounting_entry_lines")
    .select(
      `
      debit_cents,
      credit_cents,
      account_number,
      label,
      accounting_entries!inner(
        id, entity_id, entry_date, label, source, reference
      )
    `,
    )
    .eq("accounting_entries.entity_id", entityId)
    .eq("accounting_entries.source", "auto:agency_loyer_mandant")
    .gte("accounting_entries.entry_date", periodStart)
    .lte("accounting_entries.entry_date", periodEnd)
    .eq("account_number", "706000");

  // Commission entries (source = auto:agency_commission)
  const { data: commissionLines } = await supabase
    .from("accounting_entry_lines")
    .select(
      `
      debit_cents,
      credit_cents,
      account_number,
      label,
      accounting_entries!inner(
        id, entity_id, entry_date, label, source, reference
      )
    `,
    )
    .eq("accounting_entries.entity_id", entityId)
    .eq("accounting_entries.source", "auto:agency_commission")
    .gte("accounting_entries.entry_date", periodStart)
    .lte("accounting_entries.entry_date", periodEnd)
    .eq("account_number", "706100");

  // Reversement entries (source = auto:agency_reversement)
  const { data: reversementLines } = await supabase
    .from("accounting_entry_lines")
    .select(
      `
      debit_cents,
      credit_cents,
      account_number,
      accounting_entries!inner(
        id, entity_id, entry_date, label, source
      )
    `,
    )
    .eq("accounting_entries.entity_id", entityId)
    .eq("accounting_entries.source", "auto:agency_reversement")
    .gte("accounting_entries.entry_date", periodStart)
    .lte("accounting_entries.entry_date", periodEnd)
    .eq("account_number", accountNumber);

  // Charge entries (supplier invoices: source starts with auto:supplier)
  const { data: chargeLines } = await supabase
    .from("accounting_entry_lines")
    .select(
      `
      debit_cents,
      credit_cents,
      account_number,
      label,
      accounting_entries!inner(
        id, entity_id, entry_date, label, source, reference
      )
    `,
    )
    .eq("accounting_entries.entity_id", entityId)
    .like("accounting_entries.source", "auto:supplier%")
    .gte("accounting_entries.entry_date", periodStart)
    .lte("accounting_entries.entry_date", periodEnd)
    .like("account_number", "6%");

  // -------------------------------------------------------------------------
  // 4. Build Section 1: Loyers par bien par mois
  // -------------------------------------------------------------------------

  const section1Map = new Map<string, CRGSection1Item>();

  for (const line of loyerLines ?? []) {
    const entry = line.accounting_entries as unknown as {
      entry_date: string;
      label: string;
      reference: string;
    };
    const month = entry.entry_date.substring(0, 7); // YYYY-MM
    // Try to extract property info from label or reference
    const firstPropertyId = properties?.[0]?.id ?? "unknown";
    const firstPropertyAddr =
      propertyMap.get(firstPropertyId) ?? entry.label;

    const key = `${firstPropertyId}-${month}`;

    const existing = section1Map.get(key);
    const creditCents = (line.credit_cents as number) || 0;

    if (existing) {
      existing.loyerCents += creditCents;
      existing.totalCents += creditCents;
    } else {
      section1Map.set(key, {
        propertyId: firstPropertyId,
        propertyAddress: firstPropertyAddr,
        month,
        loyerCents: creditCents,
        chargesCents: 0,
        totalCents: creditCents,
      });
    }
  }

  const section1_loyers = Array.from(section1Map.values()).sort(
    (a, b) => a.month.localeCompare(b.month) || a.propertyAddress.localeCompare(b.propertyAddress),
  );

  // -------------------------------------------------------------------------
  // 5. Build Section 2: Charges par categorie
  // -------------------------------------------------------------------------

  const section2Map = new Map<string, CRGSection2Item>();

  for (const line of chargeLines ?? []) {
    const accountNum = line.account_number as string;
    const category = accountNum.substring(0, 3); // e.g. 615, 606
    const label = (line.label as string) || `Charges ${accountNum}`;
    const debitCents = (line.debit_cents as number) || 0;

    const existing = section2Map.get(category);
    if (existing) {
      existing.amountCents += debitCents;
    } else {
      section2Map.set(category, {
        category,
        label,
        amountCents: debitCents,
      });
    }
  }

  const section2_charges = Array.from(section2Map.values()).sort(
    (a, b) => a.category.localeCompare(b.category),
  );

  // -------------------------------------------------------------------------
  // 6. Build Section 3: Honoraires (commission breakdown)
  // -------------------------------------------------------------------------

  const section3_honoraires: CRGSection3Item[] = [];
  let totalHonorairesCents = 0;

  for (const line of commissionLines ?? []) {
    const creditCents = (line.credit_cents as number) || 0;
    const entry = line.accounting_entries as unknown as { label: string };

    section3_honoraires.push({
      label: entry.label,
      baseCents: commissionRate > 0 ? Math.round((creditCents * 100) / commissionRate) : 0,
      rate: commissionRate,
      commissionCents: creditCents,
    });

    totalHonorairesCents += creditCents;
  }

  // -------------------------------------------------------------------------
  // 7. Build Section 4: Net reverse summary
  // -------------------------------------------------------------------------

  const totalLoyersCents = (loyerLines ?? []).reduce(
    (sum, l) => sum + ((l.credit_cents as number) || 0),
    0,
  );

  const totalChargesCents = (chargeLines ?? []).reduce(
    (sum, l) => sum + ((l.debit_cents as number) || 0),
    0,
  );

  const alreadyReversedCents = (reversementLines ?? []).reduce(
    (sum, l) => sum + ((l.credit_cents as number) || 0),
    0,
  );

  const netReverseCents =
    totalLoyersCents - totalChargesCents - totalHonorairesCents;
  const remainingToReverseCents = Math.max(
    0,
    netReverseCents - alreadyReversedCents,
  );

  const section4_summary: CRGSection4Summary = {
    totalLoyersCents,
    totalChargesCents,
    totalHonorairesCents,
    totalTravauxCents: 0, // Populated from section 6
    netReverseCents,
    alreadyReversedCents,
    remainingToReverseCents,
  };

  // -------------------------------------------------------------------------
  // 8. Build Section 5: Impayes
  // -------------------------------------------------------------------------

  // Look for unpaid rent entries (receivables on 411000)
  const { data: impayeLines } = await supabase
    .from("accounting_entry_lines")
    .select(
      `
      debit_cents,
      credit_cents,
      label,
      accounting_entries!inner(
        id, entity_id, entry_date, label, source
      )
    `,
    )
    .eq("accounting_entries.entity_id", entityId)
    .gte("accounting_entries.entry_date", periodStart)
    .lte("accounting_entries.entry_date", periodEnd)
    .eq("account_number", "411000");

  const section5_impayes: CRGSection5Item[] = [];

  for (const line of impayeLines ?? []) {
    const entry = line.accounting_entries as unknown as {
      entry_date: string;
      label: string;
    };
    const debitCents = (line.debit_cents as number) || 0;

    if (debitCents > 0) {
      const daysPastDue = Math.floor(
        (Date.now() - new Date(entry.entry_date).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      section5_impayes.push({
        tenantName: (line.label as string) || entry.label,
        propertyAddress: propertyMap.values().next().value ?? "N/A",
        amountDueCents: debitCents,
        daysPastDue: Math.max(0, daysPastDue),
      });
    }
  }

  // -------------------------------------------------------------------------
  // 9. Build Section 6: Travaux
  // -------------------------------------------------------------------------

  // Travaux entries from supplier invoices (615xxx accounts = maintenance)
  const { data: travauxLines } = await supabase
    .from("accounting_entry_lines")
    .select(
      `
      debit_cents,
      credit_cents,
      label,
      accounting_entries!inner(
        id, entity_id, entry_date, label, source, reference
      )
    `,
    )
    .eq("accounting_entries.entity_id", entityId)
    .like("accounting_entries.source", "auto:supplier%")
    .gte("accounting_entries.entry_date", periodStart)
    .lte("accounting_entries.entry_date", periodEnd)
    .like("account_number", "615%");

  const section6_travaux: CRGSection6Item[] = [];
  let totalTravauxCents = 0;

  for (const line of travauxLines ?? []) {
    const entry = line.accounting_entries as unknown as {
      entry_date: string;
      label: string;
      reference: string | null;
    };
    const debitCents = (line.debit_cents as number) || 0;

    if (debitCents > 0) {
      section6_travaux.push({
        providerName: (line.label as string) || "Prestataire",
        description: entry.label,
        invoiceRef: entry.reference,
        amountCents: debitCents,
        date: entry.entry_date,
      });
      totalTravauxCents += debitCents;
    }
  }

  section4_summary.totalTravauxCents = totalTravauxCents;

  // -------------------------------------------------------------------------
  // 10. Insert CRG report
  // -------------------------------------------------------------------------

  const now = new Date().toISOString();

  const { data: crgReport, error: crgError } = await supabase
    .from("crg_reports")
    .insert({
      mandant_id: mandantId,
      entity_id: entityId,
      period_start: periodStart,
      period_end: periodEnd,
      generated_at: now,
      status: "generated",
      total_loyers_cents: totalLoyersCents,
      total_charges_cents: totalChargesCents,
      total_honoraires_cents: totalHonorairesCents,
      total_travaux_cents: totalTravauxCents,
      net_reverse_cents: netReverseCents,
      already_reversed_cents: alreadyReversedCents,
      remaining_to_reverse_cents: remainingToReverseCents,
      impayes_count: section5_impayes.length,
      data: {
        section1_loyers,
        section2_charges,
        section3_honoraires,
        section4_summary,
        section5_impayes,
        section6_travaux,
      },
    })
    .select()
    .single();

  if (crgError) {
    throw new Error(`Erreur creation CRG: ${crgError.message}`);
  }

  return {
    id: crgReport.id,
    mandantId,
    mandantName,
    agencyEntityId: entityId,
    periodStart,
    periodEnd,
    generatedAt: now,
    section1_loyers,
    section2_charges,
    section3_honoraires,
    section4_summary,
    section5_impayes,
    section6_travaux,
  };
}
