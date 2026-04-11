export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

/**
 * GET /api/admin/email-templates/[id]/versions — Historique des versions d'un template
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAdminPermissions(request, ["admin.templates.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

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
      { error: extractErrorMessage(error) },
      { status: 500 }
    );
  }
}
