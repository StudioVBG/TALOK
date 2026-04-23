export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { createClient } from "@/lib/supabase/server";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

export async function POST(request: Request) {
  const csrf = await validateCsrfFromRequestDetailed(request);
  if (!csrf.valid) {
    await logCsrfFailure(request, csrf.reason!, "admin.branding.upload");
    return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
  }

  const auth = await requireAdminPermissions(request, ["admin.templates.write"], {
    rateLimit: "adminCritical",
    auditAction: "Upload asset branding",
  });
  if (isAdminAuthError(auth)) return auth;
  const supabase = await createClient();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const organizationId = formData.get("organization_id") as string | null;

    if (!file || !organizationId) {
      return NextResponse.json(
        { error: "Fichier et organization_id requis" },
        { status: 400 }
      );
    }

    const fileExt = file.name.split(".").pop();
    const filePath = `branding/${organizationId}/logo-${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Branding] Upload error:", uploadError);
      return NextResponse.json({ error: "Erreur d'upload" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("assets")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    });
  } catch (error) {
    console.error("[Branding] Unexpected error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
