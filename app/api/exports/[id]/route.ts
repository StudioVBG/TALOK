export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ExportService } from "@/lib/services/export.service";

/**
 * GET /api/exports/[id] - Statut du job
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

    const { data: job, error } = await supabase
      .from("export_jobs")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Job non trouvé" }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      record_count: job.record_count,
      error_message: job.error_message,
      created_at: job.created_at,
      expires_at: job.expires_at
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

