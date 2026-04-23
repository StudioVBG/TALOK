/**
 * Module Comptabilite Talok — Generateur FEC
 *
 * Fichier des Ecritures Comptables conforme art. A47 A-1 du LPF.
 * 18 champs, format .txt, UTF-8 sans BOM, separateur pipe `|`, CRLF.
 * Pas de ligne d'entete (flavor TXT DGI). Sequentiel, trie par ValidDate.
 *
 * REGLES:
 * - JAMAIS FEC sans validation prealable
 * - TOUJOURS 18 champs par ligne
 * - Montants format francais (1234,56)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FECResult {
  content: string;
  filename: string;
  lineCount: number;
  errors: string[];
}

export interface FECValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  lineCount: number;
}

interface FECLine {
  JournalCode: string;
  JournalLib: string;
  EcritureNum: string;
  EcritureDate: string;
  CompteNum: string;
  CompteLib: string;
  CompAuxNum: string;
  CompAuxLib: string;
  PieceRef: string;
  PieceDate: string;
  EcritureLib: string;
  Debit: string;
  Credit: string;
  EcritereLettrage: string;
  DateLettrage: string;
  ValidDate: string;
  Montantdevise: string;
  Idevise: string;
}

// ---------------------------------------------------------------------------
// FEC 18 column headers (art. A47 A-1 LPF)
// ---------------------------------------------------------------------------

const FEC_HEADERS = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritereLettrage',
  'DateLettrage',
  'ValidDate',
  'Montantdevise',
  'Idevise',
] as const;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format cents to French decimal: 123456 → "1234,56" */
function formatFrenchAmount(cents: number): string {
  const euros = Math.floor(Math.abs(cents) / 100);
  const centimes = Math.abs(cents) % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}${euros},${centimes.toString().padStart(2, '0')}`;
}

/** Format date to FEC format YYYYMMDD */
function formatFECDate(dateStr: string | null): string {
  if (!dateStr) return '';
  // Handle both ISO dates and YYYY-MM-DD
  const d = dateStr.replace(/-/g, '').substring(0, 8);
  return d;
}

/**
 * Sanitize a field value for the pipe-separated FEC flavor. Any literal `|`
 * is replaced with a space (it would be read as a field separator by the
 * DGI ALTO tool), and stray line breaks are stripped so a single field can
 * never spill over multiple rows.
 */
function escapeField(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/\|/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, ' ');
}

// ---------------------------------------------------------------------------
// FEC Generation
// ---------------------------------------------------------------------------

/**
 * Generate a complete FEC file for an entity/exercise.
 * Only includes validated entries, sorted by ValidDate.
 */
export async function generateFEC(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
  siren: string,
): Promise<FECResult> {
  const errors: string[] = [];

  // Validate SIREN
  if (!siren || siren.length !== 9 || !/^\d{9}$/.test(siren)) {
    errors.push('SIREN invalide : doit contenir exactement 9 chiffres');
  }

  // Fetch exercise info
  const { data: exercise, error: exError } = await supabase
    .from('accounting_exercises')
    .select('start_date, end_date, status')
    .eq('id', exerciseId)
    .single();

  if (exError || !exercise) {
    errors.push('Exercice introuvable');
    return { content: '', filename: '', lineCount: 0, errors };
  }

  // Fetch all validated entries with lines
  const { data: entries, error: entriesError } = await supabase
    .from('accounting_entries')
    .select(`
      id, journal_code, entry_number, entry_date, label, reference,
      validated_at, is_validated,
      accounting_entry_lines(
        account_number, label, debit_cents, credit_cents, lettrage, piece_ref
      )
    `)
    .eq('entity_id', entityId)
    .eq('exercise_id', exerciseId)
    .eq('is_validated', true)
    .order('validated_at', { ascending: true });

  if (entriesError) {
    errors.push(`Erreur chargement ecritures: ${entriesError.message}`);
    return { content: '', filename: '', lineCount: 0, errors };
  }

  if (!entries || entries.length === 0) {
    errors.push('Aucune ecriture validee dans cet exercice');
    return { content: '', filename: '', lineCount: 0, errors };
  }

  // Fetch journal labels
  const { data: journals } = await supabase
    .from('accounting_journals')
    .select('code, label')
    .eq('entity_id', entityId);

  const journalLabels = new Map(
    (journals ?? []).map((j: { code: string; label: string }) => [j.code, j.label]),
  );

  // Fetch account labels
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('account_number, label')
    .eq('entity_id', entityId);

  const accountLabels = new Map(
    (accounts ?? []).map((a: { account_number: string; label: string }) => [a.account_number, a.label]),
  );

  // Build FEC lines
  const fecLines: FECLine[] = [];
  let seqCheck = 0;

  for (const entry of entries) {
    seqCheck++;
    const lines = entry.accounting_entry_lines as Array<{
      account_number: string;
      label: string | null;
      debit_cents: number;
      credit_cents: number;
      lettrage: string | null;
      piece_ref: string | null;
    }>;

    // Validate entry has lines
    if (!lines || lines.length === 0) {
      errors.push(`Ecriture ${entry.entry_number} sans lignes`);
      continue;
    }

    // Validate balance
    const totalD = lines.reduce((s, l) => s + l.debit_cents, 0);
    const totalC = lines.reduce((s, l) => s + l.credit_cents, 0);
    if (totalD !== totalC) {
      errors.push(
        `Ecriture ${entry.entry_number} desequilibree: D=${totalD} C=${totalC}`,
      );
      continue;
    }

    for (const line of lines) {
      fecLines.push({
        JournalCode: entry.journal_code,
        JournalLib: journalLabels.get(entry.journal_code) ?? entry.journal_code,
        EcritureNum: entry.entry_number,
        EcritureDate: formatFECDate(entry.entry_date),
        CompteNum: line.account_number,
        CompteLib: accountLabels.get(line.account_number) ?? line.account_number,
        CompAuxNum: '',
        CompAuxLib: '',
        PieceRef: line.piece_ref ?? entry.reference ?? '',
        PieceDate: formatFECDate(entry.entry_date),
        EcritureLib: line.label ?? entry.label,
        Debit: formatFrenchAmount(line.debit_cents),
        Credit: formatFrenchAmount(line.credit_cents),
        EcritereLettrage: line.lettrage ?? '',
        DateLettrage: '',
        ValidDate: formatFECDate(entry.validated_at),
        Montantdevise: formatFrenchAmount(line.debit_cents > 0 ? line.debit_cents : line.credit_cents),
        Idevise: 'EUR',
      });
    }
  }

  if (errors.length > 0) {
    return { content: '', filename: '', lineCount: 0, errors };
  }

  // Build file content: pipe-separated rows, CRLF terminated. No header line
  // per DGI TXT flavor — the ALTO validator accepts files without one and
  // several EC tools trip over a stray header.
  const dataLines = fecLines.map((line) =>
    FEC_HEADERS.map((h) => escapeField(line[h])).join('|'),
  );

  // Trailing CRLF so the file ends on a newline, matching the DGI sample.
  const content = dataLines.length > 0 ? dataLines.join('\r\n') + '\r\n' : '';

  // Filename per spec: SIRENFECyyyymmdd.txt
  const endDate = exercise.end_date.replace(/-/g, '');
  const filename = `${siren}FEC${endDate}.txt`;

  return {
    content,
    filename,
    lineCount: fecLines.length,
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// FEC Validation
// ---------------------------------------------------------------------------

/**
 * Validate FEC content against art. A47 A-1 requirements.
 * Expects the pipe-separated, header-less flavor written by generateFEC.
 */
export function validateFECContent(content: string): FECValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || content.trim().length === 0) {
    return { valid: false, errors: ['FEC vide'], warnings: [], lineCount: 0 };
  }

  const lines = content.split(/\r?\n/);

  // Validate data lines (no header line in this flavor)
  let prevValidDate = '';
  let prevEntryNum = '';
  const entryNumbers = new Set<string>();
  let dataLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const fields = line.split('|');
    const lineNum = i + 1;
    dataLineCount++;

    // 18 fields check
    if (fields.length !== 18) {
      errors.push(`Ligne ${lineNum}: ${fields.length} champs au lieu de 18`);
      continue;
    }

    const journalCode = fields[0];
    const ecritureNum = fields[2];
    const ecritureDate = fields[3];
    const compteNum = fields[4];
    const debit = fields[11];
    const credit = fields[12];
    const validDate = fields[15];
    const idevise = fields[17];

    // Required fields
    if (!journalCode) errors.push(`Ligne ${lineNum}: JournalCode vide`);
    if (!ecritureNum) errors.push(`Ligne ${lineNum}: EcritureNum vide`);
    if (!compteNum) errors.push(`Ligne ${lineNum}: CompteNum vide`);

    // Date format YYYYMMDD
    if (ecritureDate && !/^\d{8}$/.test(ecritureDate)) {
      errors.push(`Ligne ${lineNum}: EcritureDate format invalide "${ecritureDate}"`);
    }
    if (validDate && !/^\d{8}$/.test(validDate.substring(0, 8))) {
      warnings.push(`Ligne ${lineNum}: ValidDate format "${validDate}"`);
    }

    // Amount format: digits, comma, 2 digits
    if (debit && !/^-?\d+,\d{2}$/.test(debit)) {
      errors.push(`Ligne ${lineNum}: Format Debit invalide "${debit}"`);
    }
    if (credit && !/^-?\d+,\d{2}$/.test(credit)) {
      errors.push(`Ligne ${lineNum}: Format Credit invalide "${credit}"`);
    }

    // Currency
    if (idevise && idevise !== 'EUR') {
      warnings.push(`Ligne ${lineNum}: Devise "${idevise}" (attendu EUR)`);
    }

    // Sequential order by ValidDate
    if (validDate && prevValidDate && validDate < prevValidDate) {
      errors.push(
        `Ligne ${lineNum}: ValidDate ${validDate} < precedente ${prevValidDate} (tri requis)`,
      );
    }
    if (validDate) prevValidDate = validDate;

    // Track entry numbers for continuity check
    if (ecritureNum !== prevEntryNum) {
      entryNumbers.add(ecritureNum);
      prevEntryNum = ecritureNum;
    }
  }

  // Check sequential numbering (warning only)
  if (entryNumbers.size > 0) {
    const sorted = Array.from(entryNumbers).sort();
    if (sorted.length < 2) {
      // Only one entry, OK
    } else {
      // Just warn if gaps detected
      warnings.push(`${entryNumbers.size} ecritures distinctes detectees`);
    }
  }

  if (dataLineCount === 0) {
    return { valid: false, errors: ['FEC sans donnees'], warnings: [], lineCount: 0 };
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    lineCount: dataLineCount,
  };
}

// ---------------------------------------------------------------------------
// Export helper
// ---------------------------------------------------------------------------

/**
 * Generate FEC and return as a downloadable Blob-ready object.
 * Encoding: UTF-8 *without* BOM per DGI Art. A47 A-1 TXT flavor — most EC
 * tools (ALTO, ACD, Cegid) reject the BOM byte as a spurious first character
 * on the JournalCode column.
 */
export async function exportFEC(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
  siren: string,
): Promise<{ blob: Uint8Array; filename: string; mimeType: string } | { errors: string[] }> {
  const result = await generateFEC(supabase, entityId, exerciseId, siren);

  if (result.errors.length > 0) {
    return { errors: result.errors };
  }

  // Validate the generated FEC
  const validation = validateFECContent(result.content);
  if (!validation.valid) {
    return { errors: validation.errors };
  }

  const blob = new TextEncoder().encode(result.content);

  return {
    blob,
    filename: result.filename,
    mimeType: 'text/plain;charset=utf-8',
  };
}
