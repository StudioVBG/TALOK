// @ts-nocheck
/**
 * API Route: FEC by Exercise
 * GET /api/accounting/fec/:exerciseId - Preview or download FEC for a given exercise
 *
 * Query params:
 *   ?preview=true   - Returns validation summary only (no file download)
 *   ?siren=XXXXXXXXX - Required for download mode (9-digit SIREN)
 *
 * Uses generateFEC / exportFEC from lib/accounting/fec.ts (engine).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from '@/lib/accounting/feature-gates';
import { generateFEC, exportFEC } from '@/lib/accounting/fec';

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ exerciseId: string }>;
}

/**
 * GET /api/accounting/fec/:exerciseId
 *
 * Preview mode (?preview=true):
 *   Returns { valid, errors, warnings, lineCount }
 *
 * Download mode (default):
 *   Requires ?siren=XXXXXXXXX
 *   Returns the FEC file as a text/plain attachment
 */
export async function GET(request: Request, context: Context) {
  try {
    const { exerciseId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    // Feature gate: check subscription plan
    const featureGate = await requireAccountingAccess(profile.id, 'fec');
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const preview = searchParams.get("preview") === "true";
    const siren = searchParams.get("siren");

    // Resolve entityId from the exercise
    const { data: exercise, error: exError } = await (supabase as any)
      .from("accounting_exercises")
      .select("entity_id")
      .eq("id", exerciseId)
      .single();

    if (exError || !exercise) {
      throw new ApiError(404, "Exercice introuvable");
    }

    const entityId = exercise.entity_id as string;

    // ---------- Preview mode ----------
    if (preview) {
      const result = await generateFEC(supabase, entityId, exerciseId, '000000000');

      return NextResponse.json({
        valid: result.errors.length === 0,
        errors: result.errors,
        warnings: [],
        lineCount: result.lineCount,
      });
    }

    // ---------- Download mode ----------
    if (!siren) {
      throw new ApiError(400, "Le parametre siren est requis pour le telechargement");
    }

    const result = await exportFEC(supabase, entityId, exerciseId, siren);

    // exportFEC returns either { errors } or { blob, filename, mimeType }
    if ('errors' in result) {
      throw new ApiError(400, result.errors.join('; '));
    }

    return new NextResponse(result.blob as unknown as BodyInit, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
