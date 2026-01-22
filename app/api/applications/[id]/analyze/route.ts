export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";

/**
 * POST /api/applications/[id]/analyze - Déclencher l'analyse OCR/IDP
 * Cette route déclenche un job asynchrone pour analyser les documents
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Rate limiting pour l'analyse
    const limiter = getRateLimiterByUser(rateLimitPresets.api);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Trop de requêtes. Veuillez réessayer plus tard.",
          resetAt: limitResult.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitPresets.api.maxRequests.toString(),
            "X-RateLimit-Remaining": limitResult.remaining.toString(),
            "X-RateLimit-Reset": limitResult.resetAt.toString(),
          },
        }
      );
    }

    // Vérifier que l'application appartient à l'utilisateur
    const applicationId = id;
    const { data: application, error: appError } = await supabase
      .from("tenant_applications")
      .select("id, tenant_user, status")
      .eq("id", applicationId as any)
      .single();

    if (appError || !application || !("tenant_user" in application)) {
      return NextResponse.json(
        { error: "Application non trouvée" },
        { status: 404 }
      );
    }

    if ((application as any).tenant_user !== user.id) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer les fichiers à analyser
    const { data: files, error: filesError } = await supabase
      .from("application_files")
      .select("*")
      .eq("application_id", applicationId as any)
      .is("analyzed_at", null);

    if (filesError) throw filesError;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Aucun fichier à analyser" },
        { status: 400 }
      );
    }

    // Appeler l'Edge Function pour OCR/IDP
    try {
      const { data: ocrResult, error: functionError } = await supabase.functions.invoke(
        "analyze-documents",
        {
          body: { application_id: applicationId, files },
        }
      );

      if (functionError) {
        console.error("Erreur Edge Function OCR:", functionError);
        // Ne pas échouer complètement, marquer comme en cours
        await supabase
          .from("tenant_applications")
          .update({ status: "docs_pending" } as any)
          .eq("id", applicationId as any);

        return NextResponse.json({
          success: false,
          message: "Erreur lors de l'analyse, réessayez plus tard",
          error: functionError.message,
        });
      }

      return NextResponse.json({
        success: true,
        message: "Analyse terminée",
        files_count: files.length,
        confidence: ocrResult?.confidence || 0,
        extracted_fields: ocrResult?.extracted_fields || {},
      });
    } catch (error: unknown) {
      console.error("Erreur appel Edge Function:", error);
      // Fallback: marquer comme en cours
      await supabase
        .from("tenant_applications")
        .update({ status: "docs_pending" } as any)
        .eq("id", applicationId as any);

      return NextResponse.json({
        success: false,
        message: "Erreur lors de l'analyse",
        error: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

