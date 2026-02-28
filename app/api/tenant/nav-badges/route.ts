import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/tenant/nav-badges
 *
 * Lightweight endpoint returning unread counts for sidebar badges.
 * Returns { messages: number, requests: number }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ messages: 0, requests: 0 });
    }

    const serviceClient = getServiceClient();

    // Get profile_id for this user
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "tenant") {
      return NextResponse.json({ messages: 0, requests: 0 });
    }

    // Parallel queries for unread messages and open requests
    const [messagesResult, requestsResult] = await Promise.all([
      // Unread messages: conversations where tenant has unread messages
      serviceClient
        .from("conversations")
        .select("tenant_unread_count")
        .eq("tenant_profile_id", profile.id)
        .gt("tenant_unread_count", 0),
      // Open requests: tickets created by tenant that are not resolved/closed
      serviceClient
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("created_by_profile_id", profile.id)
        .in("statut", ["open", "in_progress", "paused"]),
    ]);

    const messagesCount = (messagesResult.data ?? []).reduce(
      (sum, { tenant_unread_count }) => sum + (tenant_unread_count ?? 0),
      0
    );
    const requestsCount = requestsResult.count || 0;

    return NextResponse.json({
      messages: messagesCount,
      requests: requestsCount,
    });
  } catch {
    return NextResponse.json({ messages: 0, requests: 0 });
  }
}
