/**
 * API Route: Validate OCR Suggestion → Create Accounting Entry
 * POST /api/accounting/documents/[id]/validate
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { createEntry, validateEntry } from "@/lib/accounting/engine";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";
import { ensureTeomRecoveryEntry } from "@/lib/accounting/teom-recovery-entry";
import { extractTeomFromAnalysis } from "@/lib/accounting/ocr-teom";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ValidateBodySchema = z.object({
  journalCode: z.string().optional(),
  accountNumber: z.string().optional(),
  accountLabel: z.string().optional(),
  amount: z.number().int().optional(),
  entryLabel: z.string().optional(),
  propertyId: z.string().uuid().optional(),
  entryDate: z.string().optional(),
  autoValidate: z.boolean().default(true),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: documentId } = await params;
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifié");

    // Service-role pour profile + analyses + écritures comptables.
    // Sécurité = check explicite via requireAccountingAccess(profile.id) +
    // entity_id de l'analyse appartient bien à un bien du profile (filtré
    // par RLS sur document_analyses via l'entity_id).
    // Voir docs/audits/rls-cascade-audit.md.
    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) throw new ApiError(403, "Profil non trouvé");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const overrides = ValidateBodySchema.parse(body);

    // Load analysis
    const { data: analysis } = await (supabase as any)
      .from("document_analyses")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!analysis) {
      throw new ApiError(404, "Aucune analyse trouvée pour ce document");
    }

    if (analysis.processing_status !== "completed") {
      throw new ApiError(400, "L'analyse n'est pas terminée");
    }

    if (analysis.entry_id) {
      throw new ApiError(400, "Ce document a déjà été validé et comptabilisé");
    }

    const entityId = analysis.entity_id;
    const extracted = analysis.extracted_data as Record<string, unknown>;

    // Merge: user overrides > extracted suggestions
    const journalCode = overrides.journalCode ?? (extracted.suggested_journal as string) ?? "ACH";
    const accountNumber = overrides.accountNumber ?? (extracted.suggested_account as string) ?? "615100";
    const accountLabel = overrides.accountLabel ?? (extracted.suggested_label as string) ?? "Charge";
    const amountCents = overrides.amount ?? (extracted.montant_ttc_cents as number) ?? 0;
    const entryLabel = overrides.entryLabel ??
      `${(extracted.document_type as string) ?? "Facture"} - ${(extracted.emetteur as Record<string, unknown>)?.nom ?? "Fournisseur"}`;
    const entryDate = overrides.entryDate ??
      (extracted.date_document as string) ??
      new Date().toISOString().split("T")[0];

    if (amountCents <= 0) {
      throw new ApiError(400, "Le montant doit être supérieur à zéro");
    }

    // Get or create exercise
    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) {
      throw new ApiError(500, "Impossible de créer l'exercice comptable");
    }

    // Create double-entry: Debit expense account / Credit supplier account
    const entry = await createEntry(supabase, {
      entityId,
      exerciseId: exercise.id,
      journalCode: journalCode as "ACH" | "VE" | "BQ" | "OD" | "AN" | "CL",
      entryDate,
      label: entryLabel,
      source: "ocr",
      reference: analysis.id,
      userId: user.id,
      lines: [
        { accountNumber, label: accountLabel, debitCents: amountCents, creditCents: 0 },
        { accountNumber: "401000", label: "Fournisseur", debitCents: 0, creditCents: amountCents },
      ],
    });

    // Auto-validate if requested
    let validated = false;
    if (overrides.autoValidate) {
      try {
        await validateEntry(supabase, entry.id, user.id);
        validated = true;
      } catch {
        // Entry created but validation failed — user can validate manually
      }
    }

    // Update analysis with entry link
    await (supabase as any)
      .from("document_analyses")
      .update({
        entry_id: entry.id,
        validated_by: user.id,
        validated_at: new Date().toISOString(),
        processing_status: "validated",
      })
      .eq("id", analysis.id);

    // Si l'OCR a détecté une part TEOM sur un avis de taxe foncière, poser
    // l'écriture de reclassement (D 635200 / C 708000) en plus de la
    // charge principale. Idempotent via reference="teom:<analysisId>".
    // L'erreur ici ne doit jamais bloquer la validation principale.
    let teomEntryId: string | undefined;
    let teomSkippedReason: string | undefined;
    const teom = extractTeomFromAnalysis(extracted);
    if (teom) {
      try {
        const teomResult = await ensureTeomRecoveryEntry(supabase, {
          entityId,
          reference: `teom:${analysis.id}`,
          amountCents: teom.teomCents,
          date: entryDate,
          label: `TEOM ${teom.annee ?? ""}`.trim(),
          userId: user.id,
        });
        if (teomResult.created) {
          teomEntryId = teomResult.entryId;
        } else {
          teomSkippedReason = teomResult.skippedReason;
          if (teomResult.entryId) teomEntryId = teomResult.entryId;
        }
      } catch (e) {
        console.error("[validate] ensureTeomRecoveryEntry failed", e);
        teomSkippedReason = "error";
      }
    }

    // Learning: if user changed account vs suggestion, save rule
    const suggestedAccount = extracted.suggested_account as string | undefined;
    const supplierName = (extracted.emetteur as Record<string, unknown>)?.nom as string | undefined;

    if (suggestedAccount && accountNumber !== suggestedAccount && supplierName) {
      try {
        await (supabase as any)
          .from("ocr_category_rules")
          .upsert(
            {
              entity_id: entityId,
              match_type: "supplier_name",
              match_value: supplierName.toLowerCase().trim(),
              target_account: accountNumber,
              target_journal: journalCode,
              hit_count: 1,
            },
            { onConflict: "entity_id,match_type,match_value" },
          );
      } catch {
        // Non-blocking — learning failure shouldn't break validation
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        entry,
        validated,
        teomEntryId: teomEntryId ?? null,
        teomSkippedReason: teomSkippedReason ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
