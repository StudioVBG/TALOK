export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/admin/crons — Liste des derniers logs cron
 */
export async function GET(request: Request) {
  const { error: authError, supabase } = await requireAdmin(request);

  if (authError || !supabase) {
    return NextResponse.json(
      { error: authError?.message || "Accès non autorisé" },
      { status: authError?.status || 403 }
    );
  }

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
