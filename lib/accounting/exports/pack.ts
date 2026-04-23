/**
 * Build a ZIP bundle of all the accounting documents an expert-comptable
 * typically needs at fiscal year closing: FEC, grand-livre PDF, balance PDF,
 * journal PDF. Returns a Node Buffer ready to be streamed back from an API
 * route or attached to a Resend email.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { exportFEC } from "@/lib/accounting/fec";
import {
  getBalance,
  getGrandLivre,
  getJournal,
} from "@/lib/accounting/engine";
import {
  renderBalancePdf,
  renderGrandLivrePdf,
  renderJournalPdf,
} from "@/lib/accounting/exports/pdf";

export interface PackResult {
  zip: Buffer;
  filename: string;
  /** Documents skipped because they are not applicable for this entity. */
  skipped: string[];
}

function slug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .toLowerCase() || "entity";
}

/**
 * Build the pack for a given (entity, exercise). When the SIREN is missing
 * the FEC is skipped with an explicit entry in `skipped` so the caller can
 * show a precise banner — other documents still ship.
 */
export async function buildAccountingPack(
  supabase: SupabaseClient,
  params: {
    entityId: string;
    exerciseId: string;
    siren: string | null;
    entityName: string;
    exerciseLabel: string;
    startDate: string;
    endDate: string;
    includeLiasse?: boolean;
  },
): Promise<PackResult> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const skipped: string[] = [];

  // FEC
  if (params.siren) {
    const fec = await exportFEC(
      supabase,
      params.entityId,
      params.exerciseId,
      params.siren,
    );
    if ("blob" in fec) {
      zip.file(fec.filename, fec.blob);
    } else {
      skipped.push(`FEC: ${fec.errors.join(", ")}`);
    }
  } else {
    skipped.push(
      "FEC: SIREN absent de l'entite — renseignez-le dans les parametres avant d'exporter le FEC.",
    );
  }

  const ctx = {
    entityName: params.entityName,
    startDate: params.startDate,
    endDate: params.endDate,
  };

  const [balance, grandLivre, journal] = await Promise.all([
    getBalance(supabase, params.entityId, params.exerciseId),
    getGrandLivre(supabase, params.entityId, params.exerciseId),
    getJournal(supabase, params.entityId, params.exerciseId),
  ]);

  const [balancePdf, glPdf, journalPdf] = await Promise.all([
    renderBalancePdf(balance, ctx),
    renderGrandLivrePdf(grandLivre, ctx),
    renderJournalPdf(journal, ctx),
  ]);

  zip.file(`balance_${params.exerciseLabel}.pdf`, balancePdf);
  zip.file(`grand-livre_${params.exerciseLabel}.pdf`, glPdf);
  zip.file(`journal_${params.exerciseLabel}.pdf`, journalPdf);

  if (params.includeLiasse) {
    // Placeholder pour la liasse fiscale preparatoire IS. La version full est
    // prevue en follow-up : on depose ici une note de route pour l'EC.
    const note = `Liasse fiscale preparatoire — ${params.entityName} — ${params.exerciseLabel}\r\n\r\nContact Talok pour la version complete de la liasse 2065.`;
    zip.file(
      `liasse-preparatoire_${params.exerciseLabel}.txt`,
      Buffer.from(note, "utf-8"),
    );
  }

  const buffer = (await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  })) as Buffer;

  return {
    zip: buffer,
    filename: `talok-pack-${slug(params.entityName)}-${slug(params.exerciseLabel)}.zip`,
    skipped,
  };
}
