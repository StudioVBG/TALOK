export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/email-templates/[id]/versions — Historique des versions d'un template
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error: authError, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    const { data: versions, error } = await supabase
      .from("email_template_versions")
      .select("*")
      .eq("template_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ versions: versions || [] });
  } catch (error: unknown) {
    console.error("[Admin Email Template Versions GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
