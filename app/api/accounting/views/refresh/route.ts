/**
 * API Route: refresh the accounting materialized views on demand.
 * GET    /api/accounting/views/refresh  — returns staleness state without refreshing.
 * POST   /api/accounting/views/refresh  — refreshes only if stale, returns the new state.
 *
 * Auth: any authenticated user with accounting access. The MVs are
 * shared across entities (filtered by SECURITY DEFINER readers) so a
 * refresh affects everyone — but it is safe (CONCURRENTLY) and cheap
 * thanks to fn_refresh_accounting_views_if_stale, which short-circuits
 * when nothing changed.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Profil introuvable");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { data: state } = await supabase
      .from("accounting_views_state")
      .select("view_name, last_modified_at, last_refreshed_at")
      .order("view_name");

    const rows = (state ?? []) as Array<{
      view_name: string;
      last_modified_at: string;
      last_refreshed_at: string;
    }>;
    const stale = rows.some(
      (r) =>
        new Date(r.last_modified_at).getTime() >
        new Date(r.last_refreshed_at).getTime(),
    );

    return NextResponse.json({
      success: true,
      data: { stale, views: rows },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Profil introuvable");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { data, error } = await supabase.rpc(
      "fn_refresh_accounting_views_if_stale",
    );
    if (error) throw new ApiError(500, `Refresh failed: ${error.message}`);

    return NextResponse.json({
      success: true,
      data: Array.isArray(data) ? data[0] : data,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
