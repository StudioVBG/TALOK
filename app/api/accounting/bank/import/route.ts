/**
 * API Route: Bank Transaction Import (CSV / OFX)
 * POST /api/accounting/bank/import
 *
 * Accepts a CSV or OFX file via multipart FormData, parses transactions,
 * inserts them into bank_transactions with deduplication, then runs
 * automatic reconciliation.
 *
 * Callers : aucun UI à ce jour. Endpoint conçu comme fallback
 * propriétaire/admin pour les banques non couvertes par GoCardless
 * (Nordigen) ou pour réimporter un export OFX ponctuel. Ne pas
 * supprimer — la connexion `bank/connections` (Open Banking) ne couvre
 * pas tous les établissements. Brancher idéalement depuis la page
 * `/owner/accounting/bank/connect` quand le besoin produit se confirme.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { reconcileTransactions } from "@/lib/accounting/reconciliation";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedTransaction {
  transaction_date: string; // YYYY-MM-DD
  amount_cents: number;
  label: string;
  raw_label: string;
  provider_transaction_id: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Hash helper for deduplication
// ---------------------------------------------------------------------------

function generateTransactionId(date: string, amountCents: number, label: string): string {
  const raw = `${date}|${amountCents}|${label}`;
  return createHash("sha256").update(raw).digest("hex").substring(0, 40);
}

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

function detectSeparator(firstLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const sep of candidates) {
    const count = firstLine.split(sep).length;
    if (count > bestCount) {
      bestCount = count;
      best = sep;
    }
  }
  return best;
}

function parseDateValue(raw: string): string | null {
  const trimmed = raw.trim().replace(/['"]/g, "");

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  // YYYYMMDD (OFX style)
  const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compactMatch) {
    const [, y, m, d] = compactMatch;
    return `${y}-${m}-${d}`;
  }

  return null;
}

function parseAmountValue(raw: string): number | null {
  let cleaned = raw.trim().replace(/['"]/g, "").replace(/\s/g, "");
  if (!cleaned) return null;

  // Handle French format: 1 234,56 or 1234,56
  // If there's a comma and no dot, treat comma as decimal separator
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && cleaned.includes(".")) {
    // If both exist, comma is thousands separator (e.g., 1,234.56)
    cleaned = cleaned.replace(/,/g, "");
  }

  const value = parseFloat(cleaned);
  if (isNaN(value)) return null;

  return Math.round(value * 100);
}

function detectColumnIndices(
  headers: string[],
): { dateIdx: number; amountIdx: number; labelIdx: number; debitIdx: number; creditIdx: number } {
  const lower = headers.map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  let dateIdx = -1;
  let amountIdx = -1;
  let labelIdx = -1;
  let debitIdx = -1;
  let creditIdx = -1;

  for (let i = 0; i < lower.length; i++) {
    const h = lower[i];

    if (dateIdx === -1 && /date/.test(h)) {
      dateIdx = i;
    }
    if (amountIdx === -1 && /montant|amount|solde/.test(h) && !/debit|credit/.test(h)) {
      amountIdx = i;
    }
    if (debitIdx === -1 && /debit|débit/.test(h)) {
      debitIdx = i;
    }
    if (creditIdx === -1 && /credit|crédit/.test(h)) {
      creditIdx = i;
    }
    if (labelIdx === -1 && /libelle|libellé|label|description|intitule|intitulé|wording|name/.test(h)) {
      labelIdx = i;
    }
  }

  // Fallback: if no label found, pick the widest text column
  if (labelIdx === -1) {
    // Use column after date if available
    if (dateIdx >= 0 && dateIdx + 1 < headers.length) {
      labelIdx = dateIdx + 1;
    } else {
      labelIdx = Math.min(1, headers.length - 1);
    }
  }

  // Fallback: if no date, use first column
  if (dateIdx === -1) dateIdx = 0;

  return { dateIdx, amountIdx, labelIdx, debitIdx, creditIdx };
}

function parseCSV(content: string): ParsedTransaction[] {
  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    throw new ApiError(400, "Le fichier CSV doit contenir au moins un en-tete et une ligne de donnees");
  }

  const separator = detectSeparator(lines[0]);
  const headers = lines[0].split(separator);
  const { dateIdx, amountIdx, labelIdx, debitIdx, creditIdx } = detectColumnIndices(headers);

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator);
    if (cols.length < 2) continue;

    const dateRaw = cols[dateIdx] ?? "";
    const date = parseDateValue(dateRaw);
    if (!date) continue; // Skip rows without valid date

    // Determine amount
    let amountCents: number | null = null;

    if (amountIdx >= 0 && cols[amountIdx]) {
      amountCents = parseAmountValue(cols[amountIdx]);
    }

    // If separate debit/credit columns
    if (amountCents === null && (debitIdx >= 0 || creditIdx >= 0)) {
      const debitVal = debitIdx >= 0 ? parseAmountValue(cols[debitIdx] ?? "") : null;
      const creditVal = creditIdx >= 0 ? parseAmountValue(cols[creditIdx] ?? "") : null;

      if (debitVal && debitVal > 0) {
        amountCents = -debitVal; // Debits are outgoing (negative)
      } else if (creditVal && creditVal > 0) {
        amountCents = creditVal; // Credits are incoming (positive)
      }
    }

    if (amountCents === null || amountCents === 0) continue;

    const rawLabel = (cols[labelIdx] ?? "").trim().replace(/^['"]|['"]$/g, "");
    const label = rawLabel.substring(0, 500);

    transactions.push({
      transaction_date: date,
      amount_cents: amountCents,
      label: label || "Import CSV",
      raw_label: rawLabel || "Import CSV",
      provider_transaction_id: generateTransactionId(date, amountCents, rawLabel),
    });
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// OFX Parser
// ---------------------------------------------------------------------------

function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Extract all <STMTTRN>...</STMTTRN> blocks
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = txRegex.exec(content)) !== null) {
    const block = match[1];

    // Extract fields using OFX tag patterns (both XML-style and SGML-style)
    const dtPosted = extractOFXField(block, "DTPOSTED");
    const trnAmt = extractOFXField(block, "TRNAMT");
    const name = extractOFXField(block, "NAME") || extractOFXField(block, "MEMO") || "";
    const fitId = extractOFXField(block, "FITID");

    if (!dtPosted || !trnAmt) continue;

    const date = parseDateValue(dtPosted);
    if (!date) continue;

    const amountCents = parseAmountValue(trnAmt);
    if (amountCents === null || amountCents === 0) continue;

    const label = name.trim().substring(0, 500) || "Import OFX";

    transactions.push({
      transaction_date: date,
      amount_cents: amountCents,
      label,
      raw_label: name.trim() || "Import OFX",
      provider_transaction_id: fitId
        ? generateTransactionId(date, amountCents, fitId)
        : generateTransactionId(date, amountCents, label),
    });
  }

  return transactions;
}

function extractOFXField(block: string, tag: string): string | null {
  // XML-style: <TAG>value</TAG>
  const xmlRegex = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, "i");
  const xmlMatch = block.match(xmlRegex);
  if (xmlMatch) return xmlMatch[1].trim();

  // SGML-style (OFX 1.x): <TAG>value\n
  const sgmlRegex = new RegExp(`<${tag}>([^\\n<]+)`, "i");
  const sgmlMatch = block.match(sgmlRegex);
  if (sgmlMatch) return sgmlMatch[1].trim();

  return null;
}

// ---------------------------------------------------------------------------
// File type detection
// ---------------------------------------------------------------------------

function detectFileType(fileName: string, content: string): "csv" | "ofx" {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "ofx" || ext === "qfx") return "ofx";
  if (ext === "csv" || ext === "txt") return "csv";

  // Content-based detection
  if (content.includes("<OFX>") || content.includes("<STMTTRN>") || content.includes("OFXHEADER")) {
    return "ofx";
  }

  return "csv";
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      throw new ApiError(403, "Acces reserve aux administrateurs");
    }

    const featureGate = await requireAccountingAccess(
      profile.id,
      "reconciliation",
    );
    if (featureGate) return featureGate;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const connectionId = formData.get("connectionId") as string | null;

    if (!file) {
      throw new ApiError(400, "Fichier requis (champ 'file')");
    }

    if (!connectionId) {
      throw new ApiError(400, "connectionId requis");
    }

    // Validate connection exists and get entity_id
    const { data: connection, error: connError } = await (supabase as any)
      .from("bank_connections")
      .select("id, entity_id")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      throw new ApiError(404, "Connexion bancaire introuvable");
    }

    const entityId = connection.entity_id as string;

    // Read file content
    const content = await file.text();
    if (!content.trim()) {
      throw new ApiError(400, "Le fichier est vide");
    }

    // Detect type and parse
    const fileType = detectFileType(file.name, content);
    let parsed: ParsedTransaction[];

    try {
      parsed = fileType === "ofx" ? parseOFX(content) : parseCSV(content);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        400,
        `Erreur de parsing ${fileType.toUpperCase()}: ${error instanceof Error ? error.message : "format invalide"}`,
      );
    }

    if (parsed.length === 0) {
      throw new ApiError(400, "Aucune transaction valide trouvee dans le fichier");
    }

    // Insert transactions with deduplication
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: [],
    };

    // Process in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
      const batch = parsed.slice(i, i + BATCH_SIZE);

      const rows = batch.map((tx) => ({
        connection_id: connectionId,
        provider: "manual",
        provider_transaction_id: tx.provider_transaction_id,
        transaction_date: tx.transaction_date,
        value_date: tx.transaction_date,
        amount_cents: tx.amount_cents,
        label: tx.label,
        raw_label: tx.raw_label,
        reconciliation_status: "pending",
      }));

      // Use upsert with onConflict to skip duplicates
      const { data: inserted, error: insertError } = await (supabase as any)
        .from("bank_transactions")
        .upsert(rows, {
          onConflict: "connection_id,provider_transaction_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (insertError) {
        result.errors.push(
          `Erreur batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`,
        );
        result.skipped += batch.length;
      } else {
        const insertedCount = inserted?.length ?? 0;
        result.imported += insertedCount;
        result.duplicates += batch.length - insertedCount;
      }
    }

    // Run reconciliation after import
    let reconciliation = null;
    try {
      const exercise = await getOrCreateCurrentExercise(supabase, entityId);
      const reconResult = await reconcileTransactions(supabase, entityId, exercise.id);
      reconciliation = reconResult.summary;
    } catch {
      // Reconciliation is best-effort after import
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          fileType,
          totalParsed: parsed.length,
          imported: result.imported,
          skipped: result.skipped,
          duplicates: result.duplicates,
          errors: result.errors,
          reconciliation,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
