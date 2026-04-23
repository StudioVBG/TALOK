export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { createClient } from "@/lib/supabase/server";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = await validateCsrfFromRequestDetailed(request);
  if (!csrf.valid) {
    await logCsrfFailure(request, csrf.reason!, "admin.branding.update");
    return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
  }

  const auth = await requireAdminPermissions(request, ["admin.templates.write"], {
    rateLimit: "adminCritical",
    auditAction: "Mise à jour branding organisation",
  });
  if (isAdminAuthError(auth)) return auth;
  const supabase = await createClient();

  try {
    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from("organizations")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Branding] Update error:", error);
      return NextResponse.json({ error: "Erreur de mise à jour" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[Branding] Unexpected error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
