export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfOrCronSecret, logCsrfFailure } from "@/lib/security/csrf";

/**
 * @maintenance Route utilitaire admin — usage ponctuel
 * @description Vérifie que la clé service-role est configurée et peut interroger Supabase
 * @usage POST /api/admin/integrations/test-service-role
 */
export async function POST(request: Request) {
  const check = await validateCsrfOrCronSecret(request);
  if (!check.valid) {
    await logCsrfFailure(request, check.reason!, "admin.maintenance.test-service-role");
    return NextResponse.json({ error: "CSRF ou cron secret requis" }, { status: 403 });
  }

  const auth = await requireAdminPermissions(request, ["admin.integrations.write"], {
    rateLimit: "adminCritical",
    auditAction: "Test service-role Supabase",
  });
  if (isAdminAuthError(auth)) return auth;

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Clé service-role ou URL Supabase manquante" },
        { status: 400 }
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error: queryError } = await serviceClient
      .from("profiles")
      .select("id")
      .limit(1);

    if (queryError) {
      throw queryError;
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Error testing service role:", err);
    return NextResponse.json(
      { error: err.message || "Test échoué" },
      { status: 500 }
    );
  }
}




