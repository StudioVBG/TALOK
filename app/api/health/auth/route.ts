export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/health/auth — Auth/Profile sync health check
 * Protected: admin only
 *
 * Returns sync status between auth.users and profiles tables.
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await requireAdmin(request);

    if (error || !user || !supabase) {
      return NextResponse.json(
        { error: error?.message ?? "Non autorise" },
        { status: error?.status ?? 403 }
      );
    }

    // Use the service client (already provided by requireAdmin)
    const serviceClient = supabase;

    // Count total auth users
    const { count: authUsersCount } = await serviceClient
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Count profiles
    const { count: profilesCount } = await serviceClient
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Count profiles without email
    const { count: profilesNoEmail } = await serviceClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .or("email.is.null,email.eq.");

    // Count profiles without role
    const { count: profilesNoRole } = await serviceClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .or("role.is.null,role.eq.");

    // Count suspended profiles
    const { count: suspendedCount } = await serviceClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("suspended", true);

    const healthy =
      (profilesNoEmail ?? 0) === 0 && (profilesNoRole ?? 0) === 0;

    return NextResponse.json({
      status: healthy ? "healthy" : "needs_attention",
      timestamp: new Date().toISOString(),
      data: {
        total_profiles: profilesCount ?? 0,
        profiles_without_email: profilesNoEmail ?? 0,
        profiles_without_role: profilesNoRole ?? 0,
        suspended_profiles: suspendedCount ?? 0,
      },
      healthy,
    });
  } catch (err) {
    console.error("[Health/Auth] Error:", err);
    return NextResponse.json(
      { status: "error", error: String(err) },
      { status: 500 }
    );
  }
}
