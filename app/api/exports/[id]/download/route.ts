export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ExportService } from "@/lib/services/export.service";

/**
 * GET /api/exports/[id]/download - Redirection vers Signed URL
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer l'URL signée via le service (qui vérifie les permissions)
    const signedUrl = await ExportService.getSignedUrl(params.id, user.id);

    // Rediriger vers l'URL signée
    return NextResponse.redirect(signedUrl);
  } catch (error: unknown) {
    console.error("Download error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 403 });
  }
}

