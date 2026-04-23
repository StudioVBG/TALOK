export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

/**
 * GET /api/admin/email-templates — Lister tous les templates email
 * Supporte le filtrage par catégorie via ?category=...
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.templates.read"], {
      rateLimit: "adminStandard",
      auditAction: "Consultation de la liste des templates d'email",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    let query = supabase
      .from("email_templates")
      .select("*")
      .order("category")
      .order("name");

    if (category) {
      query = query.eq("category", category);
    }

    const { data: templates, error } = await query;

    if (error) throw error;

    return NextResponse.json({ templates: templates || [] });
  } catch (error: unknown) {
    console.error("[Admin Email Templates GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
