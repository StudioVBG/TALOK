/**
 * API Route: OCR Document Analysis
 * POST /api/accounting/documents/analyze - Lance l'analyse OCR d'un document
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { getSubscriptionByProfileId } from "@/lib/subscriptions/subscription-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AnalyzeBodySchema = z.object({
  documentId: z.string().uuid(),
});

/** Monthly OCR quota per plan */
const OCR_QUOTAS: Record<string, number> = {
  confort: 30,
  pro: Infinity,
  enterprise_s: Infinity,
  enterprise_m: Infinity,
  enterprise_l: Infinity,
  enterprise_xl: Infinity,
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouvé");
    }

    // Feature gate
    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const { documentId } = AnalyzeBodySchema.parse(body);

    // Get entity from user's membership
    const { data: membership } = await supabase
      .from("entity_members")
      .select("entity_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      throw new ApiError(403, "Aucune entité associée à votre compte");
    }

    const entityId = membership.entity_id;

    // ── Quota check ──
    const subscription = await getSubscriptionByProfileId(profile.id);
    const planSlug = subscription?.plan_slug ?? "gratuit";
    const maxOcr = OCR_QUOTAS[planSlug] ?? 0;

    if (maxOcr === 0) {
      throw new ApiError(403, "L'analyse OCR n'est pas disponible dans votre forfait.");
    }

    if (maxOcr !== Infinity) {
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      ).toISOString();

      const { count } = await supabase
        .from("document_analyses")
        .select("id", { count: "exact", head: true })
        .eq("entity_id", entityId)
        .gte("created_at", monthStart);

      if ((count ?? 0) >= maxOcr) {
        return NextResponse.json(
          {
            error: `Quota OCR atteint : ${maxOcr} analyses/mois pour le forfait ${planSlug}. Passez au forfait supérieur pour continuer.`,
            code: "OCR_QUOTA_EXCEEDED",
            current: count,
            max: maxOcr,
            upgrade_url: "/settings/billing",
          },
          { status: 429 },
        );
      }
    }

    // ── Verify document exists and belongs to entity ──
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, sha256, entity_id")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      throw new ApiError(404, "Document non trouvé");
    }

    if (document.entity_id !== entityId) {
      throw new ApiError(403, "Ce document n'appartient pas à votre entité");
    }

    // ── Duplicate detection (SHA-256) ──
    if (document.sha256) {
      const { data: duplicates } = await supabase
        .from("documents")
        .select("id")
        .eq("sha256", document.sha256)
        .eq("entity_id", entityId)
        .neq("id", documentId)
        .limit(1);

      if (duplicates && duplicates.length > 0) {
        return NextResponse.json(
          {
            error: "Document en doublon détecté (même empreinte SHA-256).",
            code: "DUPLICATE_DOCUMENT",
            duplicate: true,
            existingDocumentId: duplicates[0].id,
          },
          { status: 409 },
        );
      }
    }

    // ── Check no analysis already pending/processing ──
    const { data: existingAnalysis } = await supabase
      .from("document_analyses")
      .select("id, processing_status")
      .eq("document_id", documentId)
      .in("processing_status", ["pending", "processing"])
      .limit(1);

    if (existingAnalysis && existingAnalysis.length > 0) {
      throw new ApiError(
        409,
        "Une analyse est déjà en cours pour ce document.",
      );
    }

    // ── Exercise check: warn if document date falls in closed exercise ──
    const alerts: string[] = [];

    const { data: closedExercises } = await supabase
      .from("accounting_exercises")
      .select("id, start_date, end_date")
      .eq("entity_id", entityId)
      .eq("status", "closed");

    if (closedExercises && closedExercises.length > 0) {
      // We'll note this as a warning — the actual document date will be checked
      // after OCR extraction. For now, flag that closed exercises exist.
      alerts.push(
        "Des exercices clôturés existent pour cette entité. Si la date du document tombe dans un exercice clôturé, l'écriture ne pourra pas être validée automatiquement.",
      );
    }

    // ── Insert analysis record ──
    const { data: analysis, error: insertError } = await supabase
      .from("document_analyses")
      .insert({
        document_id: documentId,
        entity_id: entityId,
        processing_status: "pending",
        extracted_data: {},
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[OCR Analyze] Insert error:", insertError);
      throw new ApiError(500, "Erreur lors de la création de l'analyse");
    }

    // ── Get entity territory for TVA rates ──
    const { data: entity } = await supabase
      .from("legal_entities")
      .select("territory")
      .eq("id", entityId)
      .single();

    const territory = entity?.territory ?? "metropole";

    // ── Invoke edge function ──
    const { error: fnError } = await supabase.functions.invoke(
      "ocr-analyze-document",
      {
        body: {
          documentId,
          entityId,
          territory,
          analysisId: analysis.id,
        },
      },
    );

    if (fnError) {
      // Mark analysis as failed if edge function invocation failed
      await supabase
        .from("document_analyses")
        .update({ processing_status: "failed" })
        .eq("id", analysis.id);

      console.error("[OCR Analyze] Edge function error:", fnError);
      throw new ApiError(502, "Erreur lors du lancement de l'analyse OCR");
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          analysisId: analysis.id,
          status: "analyzing",
          alerts,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
