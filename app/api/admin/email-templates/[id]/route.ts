export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

/**
 * GET /api/admin/email-templates/[id] — Récupérer un template par ID
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

    const { data: template, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!template) {
      return NextResponse.json({ error: "Template non trouvé" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error: unknown) {
    console.error("[Admin Email Template GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/email-templates/[id] — Mettre à jour un template
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrf = await validateCsrfFromRequestDetailed(request);
    if (!csrf.valid) {
      await logCsrfFailure(request, csrf.reason!, "admin.email-templates.update");
      return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
    }

    const { id } = await params;
    const auth = await requireAdminPermissions(request, ["admin.templates.write"], {
      rateLimit: "adminCritical",
      auditAction: "Update email template",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

    const body = await request.json();
    const allowedFields = [
      "subject",
      "body_html",
      "body_text",
      "is_active",
      "send_delay_minutes",
      "name",
      "description",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    const { data: template, error } = await (supabase
      .from("email_templates") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ template });
  } catch (error: unknown) {
    console.error("[Admin Email Template PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
