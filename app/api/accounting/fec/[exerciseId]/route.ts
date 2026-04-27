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

    // SIREN officiel de l'entite. Sert :
    //   - en preview comme valeur reelle (au lieu du sentinel '000000000'
    //     historique qui validait le format mais aurait genere un FEC
    //     non utilisable s'il s'echappait)
    //   - en download pour verifier que le siren passe par le client
    //     correspond bien a celui de l'entite (evite la generation d'un
    //     FEC sous une fausse identite, accidentelle ou non).
    const { data: entityRow } = await (supabase as any)
      .from("legal_entities")
      .select("siren")
      .eq("id", entityId)
      .maybeSingle();
    const entitySiren =
      typeof entityRow?.siren === "string" ? (entityRow.siren as string) : "";

    // ---------- Preview mode ----------
    if (preview) {
      // Si l'entite n'a pas de SIREN renseigne, on previsualise quand
      // meme avec '000000000' pour permettre a l'utilisateur de voir
      // les erreurs de fond (ecritures non validees, deficits, etc.)
      // — la validation du SIREN est rappelee dans errors[].
      const sirenForPreview =
        entitySiren && /^\d{9}$/.test(entitySiren) ? entitySiren : "000000000";
      const result = await generateFEC(supabase, entityId, exerciseId, sirenForPreview);

      return NextResponse.json({
        valid: result.errors.length === 0,
        errors: result.errors,
        warnings: [],
        lineCount: result.lineCount,
        sirenUsed: sirenForPreview,
        sirenIsPlaceholder: sirenForPreview === "000000000",
      });
    }

    // ---------- Download mode ----------
    if (!siren) {
      throw new ApiError(400, "Le parametre siren est requis pour le telechargement");
    }
    // Garde-fou : le SIREN passe par l'utilisateur doit matcher celui
    // enregistre sur l'entite. Si la valeur diverge on refuse plutot que
    // d'emettre un fichier sous une fausse identite. Si l'entite n'a
    // pas de SIREN, on accepte la valeur fournie (initialisation).
    if (entitySiren && entitySiren !== siren) {
      throw new ApiError(
        400,
        "Le SIREN fourni ne correspond pas a celui enregistre sur l'entite.",
      );
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
