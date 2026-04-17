/**
 * Accounting Auto-OCR trigger
 *
 * Fire-and-forget helper that launches the GPT-4o-mini OCR pipeline
 * (ocr-analyze-document edge function) for accounting documents uploaded
 * by users whose plan includes OCR quota.
 *
 * Callers must NOT await this — it is meant to be scheduled after the
 * document insert and before returning the HTTP response to the client.
 *
 * Design decisions (QW3):
 * - Skips silently on quota exhaustion, flags metadata.ocr_skipped_reason.
 * - Skips silently on missing entity or plan not eligible.
 * - Re-verifies document existence to guard against race with delete.
 * - Does NOT auto-validate — the /validate route remains human-reviewed.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Document types that trigger accounting OCR auto-analysis on upload. */
export const OCR_ACCOUNTING_DOCUMENT_TYPES = [
  'facture',
  'devis',
  'avis_imposition',
  'taxe_fonciere',
  'assurance_pno',
  'appel_fonds',
] as const;

export type OcrAccountingDocumentType =
  (typeof OCR_ACCOUNTING_DOCUMENT_TYPES)[number];

export function shouldTriggerAccountingOcr(
  type: string | null | undefined,
): type is OcrAccountingDocumentType {
  if (!type) return false;
  return (OCR_ACCOUNTING_DOCUMENT_TYPES as readonly string[]).includes(type);
}

/**
 * Monthly OCR quota per plan slug.
 * Mirrors the quota declared in app/api/accounting/documents/analyze/route.ts.
 */
const OCR_QUOTAS: Record<string, number> = {
  confort: 30,
  pro: Infinity,
  enterprise_s: Infinity,
  enterprise_m: Infinity,
  enterprise_l: Infinity,
  enterprise_xl: Infinity,
};

type OcrSkipReason = 'quota_exceeded' | 'plan_not_eligible';

export interface TriggerAccountingOcrParams {
  documentId: string;
  /** Profile id of the plan holder (= property owner). Used for quota/plan lookup. */
  ownerProfileId: string;
  entityId: string;
}

async function flagOcrSkipped(
  supabase: SupabaseClient,
  documentId: string,
  existingMetadata: unknown,
  reason: OcrSkipReason,
  planSlug: string,
): Promise<void> {
  try {
    const metadata = {
      ...((existingMetadata as Record<string, unknown> | null) ?? {}),
      ocr_skipped_reason: reason,
      ocr_skipped_plan: planSlug,
      ocr_skipped_at: new Date().toISOString(),
    };
    await supabase.from('documents').update({ metadata }).eq('id', documentId);
  } catch (err) {
    console.error('[auto-ocr] flagOcrSkipped failed', err);
  }
}

/**
 * Trigger GPT-4o-mini OCR for an accounting document.
 * Never throws — all errors are logged. Intended for fire-and-forget use.
 */
export async function triggerAccountingOcr(
  supabase: SupabaseClient,
  params: TriggerAccountingOcrParams,
): Promise<void> {
  try {
    // 1. Re-verify document existence + entity match (guard against race with delete)
    const { data: document } = await supabase
      .from('documents')
      .select('id, entity_id, metadata')
      .eq('id', params.documentId)
      .maybeSingle();

    if (!document) {
      console.warn(
        '[auto-ocr] Document not found — skipping',
        params.documentId,
      );
      return;
    }
    const doc = document as {
      id: string;
      entity_id: string | null;
      metadata: unknown;
    };
    if (doc.entity_id !== params.entityId) {
      console.warn(
        '[auto-ocr] Entity mismatch — skipping',
        params.documentId,
      );
      return;
    }

    // 2. Skip if an analysis already exists (race with other triggers)
    const { data: existing } = await supabase
      .from('document_analyses')
      .select('id')
      .eq('document_id', params.documentId)
      .limit(1);
    if (existing && existing.length > 0) {
      return;
    }

    // 3. Resolve plan + quota
    const { getSubscriptionByProfileId } = await import(
      '@/lib/subscriptions/subscription-service'
    );
    const subscription = await getSubscriptionByProfileId(
      params.ownerProfileId,
    );
    const planSlug = subscription?.plan_slug ?? 'gratuit';
    const maxOcr = OCR_QUOTAS[planSlug] ?? 0;

    if (maxOcr === 0) {
      await flagOcrSkipped(
        supabase,
        params.documentId,
        doc.metadata,
        'plan_not_eligible',
        planSlug,
      );
      return;
    }

    if (maxOcr !== Infinity) {
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      ).toISOString();
      const { count } = await supabase
        .from('document_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('entity_id', params.entityId)
        .gte('created_at', monthStart);
      if ((count ?? 0) >= maxOcr) {
        await flagOcrSkipped(
          supabase,
          params.documentId,
          doc.metadata,
          'quota_exceeded',
          planSlug,
        );
        return;
      }
    }

    // 4. Resolve territory (for TVA rate validation in edge function)
    const { data: entity } = await supabase
      .from('legal_entities')
      .select('territory')
      .eq('id', params.entityId)
      .maybeSingle();
    const territory =
      (entity as { territory?: string } | null)?.territory ?? 'metropole';

    // 5. Insert analysis record (pending)
    const { data: analysis, error: insertErr } = await supabase
      .from('document_analyses')
      .insert({
        document_id: params.documentId,
        entity_id: params.entityId,
        processing_status: 'pending',
        extracted_data: {},
      })
      .select('id')
      .single();

    if (insertErr || !analysis) {
      console.error(
        '[auto-ocr] document_analyses insert failed',
        insertErr,
      );
      return;
    }

    const analysisId = (analysis as { id: string }).id;

    // 6. Invoke edge function — still inside fire-and-forget promise
    const { error: fnErr } = await supabase.functions.invoke(
      'ocr-analyze-document',
      {
        body: {
          documentId: params.documentId,
          entityId: params.entityId,
          territory,
          analysisId,
        },
      },
    );

    if (fnErr) {
      console.error('[auto-ocr] edge function invoke failed', fnErr);
      await supabase
        .from('document_analyses')
        .update({ processing_status: 'failed' })
        .eq('id', analysisId);
    }
  } catch (err) {
    console.error(
      '[auto-ocr] unexpected error (non-blocking)',
      err instanceof Error ? err.message : err,
    );
  }
}
