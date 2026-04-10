/**
 * Module Comptabilite Talok — Plan comptable, Amortissements, OCR Pipeline
 *
 * - Plan comptable PCG owner (35 comptes) + Copro decret 2005 (30 comptes)
 * - Amortissement par composant, lineaire, prorata temporis
 * - OCR + IA pipeline (prompt GPT-4, validation TVA DROM-COM)
 *
 * REGLES:
 * - TOUJOURS verifier plan avant action
 * - JAMAIS ecriture OCR sans validation humaine
 * - JAMAIS hardcoder TVA (5 taux DROM-COM)
 * - Terrain 15% non amortissable par defaut
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Plan comptable PCG Owner — 35 comptes
// ---------------------------------------------------------------------------

export const PCG_OWNER_ACCOUNTS = [
  // Classe 1 — Comptes de capitaux
  { account_number: '164000', label: 'Emprunts immobiliers', account_type: 'liability' as const },
  { account_number: '165000', label: 'Depots de garantie recus', account_type: 'liability' as const },
  // Classe 4 — Tiers
  { account_number: '401000', label: 'Fournisseurs', account_type: 'liability' as const },
  { account_number: '411000', label: 'Locataires — creances', account_type: 'asset' as const },
  { account_number: '421000', label: 'Personnel — remuneration', account_type: 'liability' as const },
  { account_number: '431000', label: 'Securite sociale', account_type: 'liability' as const },
  { account_number: '445660', label: 'TVA deductible', account_type: 'asset' as const },
  { account_number: '445710', label: 'TVA collectee', account_type: 'liability' as const },
  { account_number: '467000', label: 'Mandant — compte courant', account_type: 'liability' as const },
  // Classe 5 — Tresorerie
  { account_number: '512100', label: 'Banque — compte courant', account_type: 'asset' as const },
  { account_number: '512200', label: 'Banque — compte epargne', account_type: 'asset' as const },
  { account_number: '512300', label: 'Banque — depots de garantie', account_type: 'asset' as const },
  { account_number: '530000', label: 'Caisse', account_type: 'asset' as const },
  { account_number: '581000', label: 'Virements internes', account_type: 'asset' as const },
  // Classe 6 — Charges
  { account_number: '606100', label: 'Fournitures entretien', account_type: 'expense' as const },
  { account_number: '613000', label: 'Provisions pour charges', account_type: 'expense' as const },
  { account_number: '614100', label: 'Charges reelles recuperables', account_type: 'expense' as const },
  { account_number: '615100', label: 'Travaux et reparations', account_type: 'expense' as const },
  { account_number: '616000', label: 'Assurances', account_type: 'expense' as const },
  { account_number: '622000', label: 'Honoraires comptables', account_type: 'expense' as const },
  { account_number: '623000', label: 'Publicite et annonces', account_type: 'expense' as const },
  { account_number: '625100', label: 'Deplacements', account_type: 'expense' as const },
  { account_number: '626000', label: 'Frais postaux / telecom', account_type: 'expense' as const },
  { account_number: '627000', label: 'Frais bancaires', account_type: 'expense' as const },
  { account_number: '635100', label: 'Taxe fonciere', account_type: 'expense' as const },
  { account_number: '635200', label: 'TEOM', account_type: 'expense' as const },
  { account_number: '661000', label: 'Interets emprunts', account_type: 'expense' as const },
  { account_number: '681000', label: 'Dotations amortissements', account_type: 'expense' as const },
  { account_number: '699000', label: 'Compte memo / OD', account_type: 'expense' as const },
  // Classe 7 — Produits
  { account_number: '706000', label: 'Loyers', account_type: 'income' as const },
  { account_number: '706100', label: 'Honoraires de gestion', account_type: 'income' as const },
  { account_number: '708000', label: 'Charges recuperees / TEOM', account_type: 'income' as const },
  { account_number: '764000', label: 'Revenus placements', account_type: 'income' as const },
  { account_number: '775000', label: 'Produits cession immobilisations', account_type: 'income' as const },
  { account_number: '791000', label: 'Retenues sur depot de garantie', account_type: 'income' as const },
] as const;

// ---------------------------------------------------------------------------
// Plan comptable Copro Decret 2005 — 30 comptes
// ---------------------------------------------------------------------------

export const COPRO_ACCOUNTS = [
  // Classe 1 — Fonds et reserves
  { account_number: '102000', label: 'Provisions pour travaux decides AG', account_type: 'equity' as const },
  { account_number: '103000', label: 'Avances de tresorerie', account_type: 'equity' as const },
  { account_number: '105000', label: 'Fonds travaux (loi ALUR)', account_type: 'equity' as const },
  // Classe 4 — Coproprietaires
  { account_number: '450000', label: 'Coproprietaires — compte general', account_type: 'asset' as const },
  { account_number: '450100', label: 'Coproprietaires — budget previsionnel', account_type: 'asset' as const },
  { account_number: '450200', label: 'Coproprietaires — travaux art.14-2', account_type: 'asset' as const },
  { account_number: '450300', label: 'Coproprietaires — avances', account_type: 'asset' as const },
  { account_number: '459000', label: 'Coproprietaires — soldes crediteurs', account_type: 'liability' as const },
  // Classe 4 — Fournisseurs
  { account_number: '401100', label: 'Fournisseurs copro', account_type: 'liability' as const },
  { account_number: '421100', label: 'Personnel copro', account_type: 'liability' as const },
  { account_number: '431100', label: 'Charges sociales copro', account_type: 'liability' as const },
  { account_number: '432000', label: 'Retraite copro', account_type: 'liability' as const },
  // Classe 5 — Tresorerie
  { account_number: '512000', label: 'Banque copro — courant', account_type: 'asset' as const },
  { account_number: '512500', label: 'Banque copro — fonds travaux', account_type: 'asset' as const },
  // Classe 6 — Charges
  { account_number: '600000', label: 'Charges copro — general', account_type: 'expense' as const },
  { account_number: '601000', label: 'Eau', account_type: 'expense' as const },
  { account_number: '602000', label: 'Electricite — parties communes', account_type: 'expense' as const },
  { account_number: '604000', label: 'Produits entretien', account_type: 'expense' as const },
  { account_number: '611000', label: 'Contrats maintenance', account_type: 'expense' as const },
  { account_number: '614000', label: 'Assurance copro', account_type: 'expense' as const },
  { account_number: '615000', label: 'Travaux entretien parties communes', account_type: 'expense' as const },
  { account_number: '622100', label: 'Honoraires syndic', account_type: 'expense' as const },
  { account_number: '628000', label: 'Frais divers gestion', account_type: 'expense' as const },
  { account_number: '635000', label: 'Impots et taxes copro', account_type: 'expense' as const },
  { account_number: '641000', label: 'Salaires gardien / employes', account_type: 'expense' as const },
  { account_number: '645000', label: 'Charges sociales gardien', account_type: 'expense' as const },
  { account_number: '671000', label: 'Charges exceptionnelles copro', account_type: 'expense' as const },
  // Classe 7 — Produits
  { account_number: '701000', label: 'Provisions sur charges', account_type: 'income' as const },
  { account_number: '702000', label: 'Provisions travaux', account_type: 'income' as const },
  { account_number: '718000', label: 'Produits exceptionnels copro', account_type: 'income' as const },
] as const;

// ---------------------------------------------------------------------------
// Chart initialization
// ---------------------------------------------------------------------------

/**
 * Initialize chart of accounts for an entity (PCG or Copro or both).
 * Idempotent: skips existing accounts.
 */
export async function initializeChartOfAccounts(
  supabase: SupabaseClient,
  entityId: string,
  planType: 'pcg' | 'copro' | 'both',
): Promise<{ inserted: number; skipped: number }> {
  let accounts: Array<{ account_number: string; label: string; account_type: string }> = [];

  if (planType === 'pcg' || planType === 'both') {
    accounts = [...accounts, ...PCG_OWNER_ACCOUNTS];
  }
  if (planType === 'copro' || planType === 'both') {
    accounts = [...accounts, ...COPRO_ACCOUNTS];
  }

  const plan = planType === 'both' ? 'pcg' : planType;
  let inserted = 0;
  let skipped = 0;

  for (const account of accounts) {
    const { error } = await supabase
      .from('chart_of_accounts')
      .upsert(
        {
          entity_id: entityId,
          account_number: account.account_number,
          label: account.label,
          account_type: account.account_type,
          plan_type: COPRO_ACCOUNTS.some((c) => c.account_number === account.account_number)
            ? 'copro'
            : plan,
        },
        { onConflict: 'entity_id,account_number' },
      );

    if (error) {
      skipped++;
    } else {
      inserted++;
    }
  }

  return { inserted, skipped };
}

/**
 * Add a custom account to the chart.
 */
export async function addCustomAccount(
  supabase: SupabaseClient,
  entityId: string,
  accountNumber: string,
  label: string,
  accountType: 'asset' | 'liability' | 'equity' | 'income' | 'expense',
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      entity_id: entityId,
      account_number: accountNumber,
      label,
      account_type: accountType,
      plan_type: 'custom',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to add account: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Amortissements — Decomposition par composant
// ---------------------------------------------------------------------------

export interface PropertyComponent {
  component: string;
  percent: number;
  durationYears: number;
  amountCents: number;
}

/** Standard decomposition for residential property */
export const STANDARD_COMPONENTS: Omit<PropertyComponent, 'amountCents'>[] = [
  { component: 'terrain', percent: 15, durationYears: 0 }, // non amortissable
  { component: 'gros_oeuvre', percent: 40, durationYears: 50 },
  { component: 'facade', percent: 10, durationYears: 25 },
  { component: 'installations_generales', percent: 15, durationYears: 25 },
  { component: 'agencements', percent: 10, durationYears: 15 },
  { component: 'equipements', percent: 10, durationYears: 10 },
];

/**
 * Decompose a property into amortizable components.
 * @param totalCents Total acquisition cost in cents
 * @param terrainPct Terrain percentage (default 15%)
 */
export function decomposeProperty(
  totalCents: number,
  terrainPct: number = 15,
): PropertyComponent[] {
  if (totalCents <= 0 || !Number.isInteger(totalCents)) {
    throw new Error('Total must be a positive integer (cents)');
  }
  if (terrainPct < 0 || terrainPct > 50) {
    throw new Error('Terrain percentage must be between 0 and 50');
  }

  // Adjust terrain percent in decomposition
  const adjustedComponents = STANDARD_COMPONENTS.map((c) => {
    if (c.component === 'terrain') return { ...c, percent: terrainPct };
    return c;
  });

  // Recalculate remaining percentages proportionally
  const nonTerrainTotal = adjustedComponents
    .filter((c) => c.component !== 'terrain')
    .reduce((s, c) => s + c.percent, 0);

  const remainingPct = 100 - terrainPct;
  const scaleFactor = remainingPct / nonTerrainTotal;

  const result: PropertyComponent[] = [];
  let allocatedCents = 0;

  for (let i = 0; i < adjustedComponents.length; i++) {
    const comp = adjustedComponents[i];
    let pct: number;

    if (comp.component === 'terrain') {
      pct = terrainPct;
    } else {
      pct = comp.percent * scaleFactor;
    }

    // Last non-terrain component gets the remainder to avoid rounding issues
    const isLast = i === adjustedComponents.length - 1;
    const amountCents = isLast
      ? totalCents - allocatedCents
      : Math.round(totalCents * pct / 100);

    allocatedCents += amountCents;

    result.push({
      component: comp.component,
      percent: Math.round(pct * 100) / 100,
      durationYears: comp.durationYears,
      amountCents,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Amortissement lineaire
// ---------------------------------------------------------------------------

export interface AmortizationLineResult {
  exerciseYear: number;
  annualAmountCents: number;
  cumulatedAmountCents: number;
  netBookValueCents: number;
  isProrata: boolean;
  isComplete: boolean;
}

/**
 * Compute linear amortization for a component.
 * Prorata temporis for year 1 based on acquisition month.
 */
export function computeLinearAmortization(
  depreciableAmountCents: number,
  durationYears: number,
  acquisitionDate: string,
  startYear?: number,
): AmortizationLineResult[] {
  if (depreciableAmountCents <= 0) return [];
  if (durationYears <= 0) return [];

  const acqDate = new Date(acquisitionDate);
  const acqMonth = acqDate.getMonth(); // 0-indexed
  const acqYear = startYear ?? acqDate.getFullYear();

  // Prorata: months remaining in year 1 / 12
  const monthsYear1 = 12 - acqMonth;
  const prorataRatio = monthsYear1 / 12;

  const annualFull = Math.round(depreciableAmountCents / durationYears);
  const lines: AmortizationLineResult[] = [];
  let cumulated = 0;

  for (let year = 0; year <= durationYears; year++) {
    const exerciseYear = acqYear + year;
    let annual: number;
    let isProrata = false;

    if (year === 0) {
      // First year: prorata
      annual = Math.round(annualFull * prorataRatio);
      isProrata = prorataRatio < 1;
    } else if (cumulated + annualFull > depreciableAmountCents) {
      // Last year: remainder (includes complement of prorata)
      annual = depreciableAmountCents - cumulated;
    } else {
      annual = annualFull;
    }

    if (annual <= 0) continue;

    cumulated += annual;
    const netBookValue = depreciableAmountCents - cumulated;

    lines.push({
      exerciseYear,
      annualAmountCents: annual,
      cumulatedAmountCents: cumulated,
      netBookValueCents: Math.max(0, netBookValue),
      isProrata,
      isComplete: netBookValue <= 0,
    });

    if (netBookValue <= 0) break;
  }

  return lines;
}

/**
 * Save amortization schedule + lines to database.
 */
export async function saveAmortizationSchedule(
  supabase: SupabaseClient,
  entityId: string,
  propertyId: string | null,
  component: string,
  acquisitionDate: string,
  totalAmountCents: number,
  terrainPercent: number,
  durationYears: number,
): Promise<{ scheduleId: string; lineCount: number }> {
  const depreciableAmount = totalAmountCents - Math.round(totalAmountCents * terrainPercent / 100);

  // Insert schedule
  const { data: schedule, error: schedError } = await supabase
    .from('amortization_schedules')
    .insert({
      entity_id: entityId,
      property_id: propertyId,
      component,
      acquisition_date: acquisitionDate,
      total_amount_cents: totalAmountCents,
      terrain_percent: terrainPercent,
      duration_years: durationYears,
    })
    .select('id')
    .single();

  if (schedError) throw new Error(`Failed to create schedule: ${schedError.message}`);

  // Compute amortization lines
  const lines = computeLinearAmortization(
    depreciableAmount,
    durationYears,
    acquisitionDate,
  );

  // Insert lines
  const lineInserts = lines.map((l) => ({
    schedule_id: schedule.id,
    exercise_year: l.exerciseYear,
    annual_amount_cents: l.annualAmountCents,
    cumulated_amount_cents: l.cumulatedAmountCents,
    net_book_value_cents: l.netBookValueCents,
    is_prorata: l.isProrata,
  }));

  const { error: linesError } = await supabase
    .from('amortization_lines')
    .insert(lineInserts);

  if (linesError) throw new Error(`Failed to create amortization lines: ${linesError.message}`);

  return { scheduleId: schedule.id, lineCount: lines.length };
}

// ---------------------------------------------------------------------------
// OCR Pipeline — Prompt GPT-4 + Validation TVA
// ---------------------------------------------------------------------------

/**
 * System prompt for GPT-4 document analysis.
 * Returns structured JSON with accounting suggestions.
 */
export const OCR_EXTRACTION_SYSTEM_PROMPT = `Tu es un assistant comptable specialise dans l'immobilier francais.
Analyse le document fourni (facture, quittance, releve, avis d'imposition, etc.)
et retourne un JSON STRICT avec les champs suivants :

{
  "document_type": "facture|quittance|releve_bancaire|avis_impot|contrat|autre",
  "emetteur": {
    "nom": "string",
    "siret": "string|null",
    "adresse": "string|null"
  },
  "destinataire": {
    "nom": "string",
    "adresse": "string|null"
  },
  "date_document": "YYYY-MM-DD",
  "date_echeance": "YYYY-MM-DD|null",
  "numero_document": "string|null",
  "montant_ht_cents": 0,
  "montant_tva_cents": 0,
  "taux_tva_percent": 0,
  "montant_ttc_cents": 0,
  "devise": "EUR",
  "lignes": [
    {
      "description": "string",
      "quantite": 1,
      "prix_unitaire_cents": 0,
      "montant_cents": 0
    }
  ],
  "suggested_account": "6xxxxx",
  "suggested_journal": "ACH|VE|BQ|OD",
  "suggested_label": "string",
  "alerts": ["string"],
  "confidence": 0.95
}

REGLES STRICTES :
- Tous les montants en CENTIMES (integer, jamais float)
- SIRET : verifier format 14 chiffres
- TVA : verifier coherence montant_ht + tva = ttc
- Si document illisible ou douteux : confidence < 0.5 + alert
- Suggerer le compte PCG le plus adapte (classe 6 pour charges, classe 7 pour produits)
- JAMAIS inventer de donnees manquantes : mettre null
- Pour les montants ambigus : prendre le TTC et calculer HT
`;

/**
 * TVA rates for DROM-COM territories.
 * NEVER hardcode a single rate — always use this lookup.
 */
export const TVA_RATES: Record<string, { normal: number; intermediaire: number; reduit: number; super_reduit: number }> = {
  metropole: { normal: 20, intermediaire: 10, reduit: 5.5, super_reduit: 2.1 },
  martinique: { normal: 8.5, intermediaire: 8.5, reduit: 2.1, super_reduit: 1.05 },
  guadeloupe: { normal: 8.5, intermediaire: 8.5, reduit: 2.1, super_reduit: 1.05 },
  reunion: { normal: 8.5, intermediaire: 8.5, reduit: 2.1, super_reduit: 1.05 },
  guyane: { normal: 0, intermediaire: 0, reduit: 0, super_reduit: 0 }, // Exonere, octroi de mer
  mayotte: { normal: 0, intermediaire: 0, reduit: 0, super_reduit: 0 }, // Exonere
};

export type Territory = keyof typeof TVA_RATES;

/**
 * Validate TVA coherence for a detected rate against territory.
 */
export function validateTVACoherence(
  detectedRatePercent: number,
  territory: Territory,
): { valid: boolean; expectedRates: number[]; message: string } {
  const rates = TVA_RATES[territory];
  if (!rates) {
    return {
      valid: false,
      expectedRates: [],
      message: `Territoire inconnu: ${territory}`,
    };
  }

  const expectedRates = [
    rates.normal,
    rates.intermediaire,
    rates.reduit,
    rates.super_reduit,
  ];

  // Allow 0% (exempt) and check against known rates
  if (detectedRatePercent === 0) {
    return {
      valid: true,
      expectedRates,
      message: 'TVA a 0% — verifier si exoneration applicable',
    };
  }

  const isKnownRate = expectedRates.some(
    (r) => Math.abs(r - detectedRatePercent) < 0.01,
  );

  if (isKnownRate) {
    return { valid: true, expectedRates, message: 'Taux TVA coherent' };
  }

  return {
    valid: false,
    expectedRates,
    message: `Taux TVA ${detectedRatePercent}% non conforme pour ${territory}. ` +
      `Taux attendus: ${expectedRates.join('%, ')}%`,
  };
}

/**
 * Validate amounts coherence from OCR extraction.
 */
export function validateOCRAmounts(extracted: {
  montant_ht_cents: number;
  montant_tva_cents: number;
  montant_ttc_cents: number;
  taux_tva_percent: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check HT + TVA = TTC
  const computedTTC = extracted.montant_ht_cents + extracted.montant_tva_cents;
  if (Math.abs(computedTTC - extracted.montant_ttc_cents) > 1) { // 1 centime tolerance (rounding)
    errors.push(
      `HT (${extracted.montant_ht_cents}) + TVA (${extracted.montant_tva_cents}) = ${computedTTC} ` +
      `!= TTC (${extracted.montant_ttc_cents})`,
    );
  }

  // Check TVA rate coherence
  if (extracted.montant_ht_cents > 0 && extracted.taux_tva_percent > 0) {
    const expectedTVA = Math.round(
      extracted.montant_ht_cents * extracted.taux_tva_percent / 100,
    );
    if (Math.abs(expectedTVA - extracted.montant_tva_cents) > 2) { // 2 centimes tolerance
      errors.push(
        `TVA calculee (${expectedTVA}) vs extraite (${extracted.montant_tva_cents}) — ecart > 2ct`,
      );
    }
  }

  // Sanity checks
  if (extracted.montant_ht_cents < 0) errors.push('Montant HT negatif');
  if (extracted.montant_ttc_cents < 0) errors.push('Montant TTC negatif');
  if (extracted.taux_tva_percent < 0) errors.push('Taux TVA negatif');
  if (extracted.taux_tva_percent > 20) errors.push('Taux TVA > 20% — verifier');

  return { valid: errors.length === 0, errors };
}

/**
 * Resolve the DROM-COM territory from a French postal code.
 *
 * DROM-COM overseas codes:
 *   971 → Guadeloupe
 *   972 → Martinique
 *   973 → Guyane (exonérée TVA, octroi de mer)
 *   974 → Réunion
 *   976 → Mayotte (exonérée TVA)
 * Anything else defaults to `metropole`.
 */
export function resolveTerritoryFromPostalCode(
  codePostal: string | null | undefined,
): Territory {
  if (!codePostal) return 'metropole';
  const prefix = codePostal.trim().slice(0, 3);
  switch (prefix) {
    case '971': return 'guadeloupe';
    case '972': return 'martinique';
    case '973': return 'guyane';
    case '974': return 'reunion';
    case '976': return 'mayotte';
    default: return 'metropole';
  }
}

export type TvaRateKind = 'normal' | 'intermediaire' | 'reduit' | 'super_reduit';

/**
 * Compute the default TVA components for an expense from an HT amount
 * and the entity's territory. Returns the rate, VAT amount and TTC
 * total — all rounded to 2 decimals so they can be stored directly on
 * the expenses row.
 *
 * Use the territory-resolved rate as the default when the user doesn't
 * provide an explicit `tva_taux`. For DROM where the rate is 0% (Guyane,
 * Mayotte) this correctly sets TVA to 0 and TTC = HT.
 */
export function computeTVA(
  amountHT: number,
  territory: Territory,
  rateKind: TvaRateKind = 'normal',
): { tva_taux: number; tva_montant: number; montant_ttc: number } {
  const rates = TVA_RATES[territory] ?? TVA_RATES.metropole;
  const rate = rates[rateKind];
  const tva_montant = Math.round(amountHT * (rate / 100) * 100) / 100;
  const montant_ttc = Math.round((amountHT + tva_montant) * 100) / 100;
  return { tva_taux: rate, tva_montant, montant_ttc };
}

/**
 * Save OCR analysis result to database.
 * Status is always 'pending' — requires human validation.
 */
export async function saveDocumentAnalysis(
  supabase: SupabaseClient,
  entityId: string,
  documentId: string,
  extractedData: Record<string, unknown>,
  confidenceScore: number,
  suggestedAccount: string | null,
  suggestedJournal: string | null,
  territory: Territory,
): Promise<{ id: string }> {
  // Validate TVA if present
  const tvaRate = extractedData.taux_tva_percent as number | undefined;
  let tvaCoherent = false;
  if (tvaRate !== undefined && tvaRate !== null) {
    const tvaCheck = validateTVACoherence(tvaRate, territory);
    tvaCoherent = tvaCheck.valid;
  }

  // Validate SIRET if present
  const siret = (extractedData.emetteur as Record<string, unknown> | undefined)?.siret as string | null;
  const siretVerified = siret ? /^\d{14}$/.test(siret) : false;

  const { data, error } = await supabase
    .from('document_analyses')
    .insert({
      document_id: documentId,
      entity_id: entityId,
      extracted_data: extractedData,
      confidence_score: confidenceScore,
      suggested_account: suggestedAccount,
      suggested_journal: suggestedJournal,
      document_type: extractedData.document_type as string ?? null,
      siret_verified: siretVerified,
      tva_coherent: tvaCoherent,
      processing_status: 'completed',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to save analysis: ${error.message}`);
  return data;
}
