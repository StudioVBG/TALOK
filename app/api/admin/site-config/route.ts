export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { createClient } from "@/lib/supabase/server";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermissions(request, ["admin.templates.read"], {
    rateLimit: "adminStandard",
    auditAction: "Consultation config site",
  });
  if (isAdminAuthError(auth)) return auth;
  const supabase = await createClient();

  try {
    const section = request.nextUrl.searchParams.get("section");

    let query = supabase
      .from("site_config")
      .select("key, value, label, section, updated_at")
      .order("section")
      .order("key");

    if (section) {
      query = query.eq("section", section);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const csrf = await validateCsrfFromRequestDetailed(request);
  if (!csrf.valid) {
    await logCsrfFailure(request, csrf.reason!, "admin.site-config.update");
    return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
  }

  const auth = await requireAdminPermissions(request, ["admin.templates.write"], {
    rateLimit: "adminCritical",
    auditAction: "Mise à jour config site",
  });
  if (isAdminAuthError(auth)) return auth;
  const supabase = await createClient();

  try {
    const { key, value } = await request.json();

    if (!key) {
      return NextResponse.json({ error: "Clé requise" }, { status: 400 });
    }

    const { error } = await supabase
      .from("site_config")
      .update({ value })
      .eq("key", key);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/(marketing)");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
