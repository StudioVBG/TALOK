export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/crons — Liste des derniers logs cron
 */
export async function GET(request: Request) {
  const auth = await requireAdminPermissions(request, ["admin.integrations.read"], {
    rateLimit: "adminStandard",
    auditAction: "Consultation logs cron",
  });
  if (isAdminAuthError(auth)) return auth;
  const supabase = await createClient();

  // Try to fetch from cron_logs table (may not exist yet)
  let logs: any[] = [];
  try {
    const { data, error } = await supabase
      .from("cron_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      logs = data;
    }
  } catch {
    // Table doesn't exist yet — return empty
  }

  return NextResponse.json({ logs });
}
