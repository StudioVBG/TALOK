import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || !["admin", "platform_admin"].includes(profile.role)) return null;
  return profile;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const priority = searchParams.get("priority") || "all";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("per_page") || "20", 10);
  const offset = (page - 1) * perPage;

  const serviceClient = createServiceRoleClient();

  let query = serviceClient
    .from("support_tickets")
    .select(`
      *,
      user:profiles!support_tickets_user_id_fkey(id, prenom, nom, email, role, avatar_url),
      assignee:profiles!support_tickets_assigned_to_fkey(id, prenom, nom, email)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (priority !== "all") {
    query = query.eq("priority", priority);
  }

  const { data: tickets, count, error } = await query;

  if (error) {
    console.error("[admin/support] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  // Stats
  const { data: statsData } = await serviceClient
    .from("support_tickets")
    .select("status, priority", { count: "exact" });

  const stats = {
    total: statsData?.length || 0,
    open: statsData?.filter((t: Record<string, unknown>) => t.status === "open").length || 0,
    in_progress: statsData?.filter((t: Record<string, unknown>) => t.status === "in_progress").length || 0,
    waiting: statsData?.filter((t: Record<string, unknown>) => t.status === "waiting").length || 0,
    resolved: statsData?.filter((t: Record<string, unknown>) => t.status === "resolved").length || 0,
    closed: statsData?.filter((t: Record<string, unknown>) => t.status === "closed").length || 0,
    urgent: statsData?.filter((t: Record<string, unknown>) => t.priority === "urgent").length || 0,
    high: statsData?.filter((t: Record<string, unknown>) => t.priority === "high").length || 0,
  };

  return NextResponse.json({ tickets: tickets || [], total: count || 0, stats });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const body = await request.json();
  const { id, status, priority, assigned_to } = body;

  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const serviceClient = createServiceRoleClient();

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (priority) updates.priority = priority;
  if (assigned_to !== undefined) updates.assigned_to = assigned_to;
  if (status === "resolved" || status === "closed") {
    updates.resolved_at = new Date().toISOString();
  }

  const { data, error } = await serviceClient
    .from("support_tickets")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log admin action
  await serviceClient.rpc("log_admin_action", {
    p_action: `support_ticket_${status || "update"}`,
    p_target_type: "support_ticket",
    p_target_id: id,
    p_details: updates,
  }).catch(() => {});

  return NextResponse.json({ ticket: data });
}
