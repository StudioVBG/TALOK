import { createClient } from "@/lib/supabase/server";

export async function getTickets(role: "owner" | "tenant" | "provider") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return [];

  let query = supabase
    .from("tickets")
    .select(
      `
      *,
      property:properties(adresse_complete),
      lease:leases(id, date_debut, date_fin, statut),
      creator:profiles!created_by_profile_id(nom, prenom, role),
      assignee:profiles!assigned_to(nom, prenom, role),
      messages:ticket_messages(count),
      ticket_comments(count),
      work_orders(
        id,
        statut,
        date_intervention_prevue,
        cout_estime,
        cout_final,
        provider:profiles!provider_id(id, nom, prenom, telephone)
      )
    `
    )
    .order("created_at", { ascending: false });

  if (role === "tenant") {
    query = query.eq("created_by_profile_id", profile.id);
  } else if (role === "owner") {
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", profile.id);

    const propertyIds = properties?.map((p) => p.id) || [];
    if (propertyIds.length === 0) return [];
    query = query.in("property_id", propertyIds);
  } else if (role === "provider") {
    // Tickets assigned directly OR through work_orders
    const { data: jobs } = await supabase
      .from("work_orders")
      .select("ticket_id")
      .eq("provider_id", profile.id);

    const woTicketIds = jobs?.map((j) => j.ticket_id).filter(Boolean) || [];

    const { data: assigned } = await supabase
      .from("tickets")
      .select("id")
      .eq("assigned_to", profile.id);

    const assignedIds = assigned?.map((t) => t.id) || [];

    const allIds = [...new Set([...woTicketIds, ...assignedIds])];
    if (allIds.length === 0) return [];
    query = query.in("id", allIds);
  }

  const { data, error } = await query;

  if (error) {
    // RLS infinite recursion (42P17) — return empty gracefully
    if (error.code === "42P17" || error.message?.includes("infinite recursion")) {
      console.warn("[getTickets] RLS recursion detected, returning empty:", error.message);
      return [];
    }
    console.error("[getTickets] Supabase error:", error.message);
    return [];
  }

  return data || [];
}

export async function getTicketDetails(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select(
      `
      *,
      property:properties(adresse_complete, ville, code_postal, owner_id),
      creator:profiles!created_by_profile_id(id, nom, prenom, role, email, telephone),
      assignee:profiles!assigned_to(id, nom, prenom, role, telephone),
      ticket_comments(
        id,
        content,
        attachments,
        is_internal,
        created_at,
        author:profiles!author_id(id, nom, prenom, role, avatar_url)
      ),
      work_orders(
        id,
        statut,
        date_intervention_prevue,
        date_intervention_reelle,
        cout_estime,
        cout_final,
        provider:profiles!provider_id(id, nom, prenom, telephone)
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "42P17" || error.message?.includes("infinite recursion")) {
      console.warn("[getTicketDetails] RLS recursion detected:", error.message);
      return null;
    }
    console.error("[getTicketDetails] Supabase error:", error.message);
    return null;
  }

  return data;
}

export async function getTicketKPIs() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) return null;

  let propertyIds: string[] = [];

  if (profile.role === "owner") {
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", profile.id);
    propertyIds = properties?.map((p) => p.id) || [];
    if (propertyIds.length === 0) return null;
  } else if (profile.role !== "admin") {
    return null;
  }

  let query = supabase
    .from("tickets")
    .select("id, statut, priorite, category, created_at, resolved_at, satisfaction_rating");

  if (propertyIds.length > 0) {
    query = query.in("property_id", propertyIds);
  }

  const { data: tickets } = await query;
  if (!tickets) return null;

  const open = tickets.filter((t) =>
    ["open", "acknowledged", "assigned", "reopened"].includes(t.statut)
  ).length;
  const inProgress = tickets.filter((t) => t.statut === "in_progress").length;
  const resolved = tickets.filter((t) => t.statut === "resolved").length;
  const closed = tickets.filter((t) => t.statut === "closed").length;

  // Average resolution time
  const resolvedTickets = tickets.filter((t) => t.resolved_at);
  let avgResolutionHours: number | null = null;
  if (resolvedTickets.length > 0) {
    const totalHours = resolvedTickets.reduce((sum, t) => {
      const created = new Date(t.created_at).getTime();
      const resolvedAt = new Date(t.resolved_at!).getTime();
      return sum + (resolvedAt - created) / (1000 * 60 * 60);
    }, 0);
    avgResolutionHours = Math.round(totalHours / resolvedTickets.length);
  }

  // Average satisfaction
  const rated = tickets.filter((t) => t.satisfaction_rating);
  const avgSatisfaction =
    rated.length > 0
      ? Math.round(
          (rated.reduce((s, t) => s + t.satisfaction_rating!, 0) / rated.length) * 10
        ) / 10
      : null;

  // By category
  const byCategory: Record<string, number> = {};
  tickets.forEach((t) => {
    const cat = t.category || "non_categorise";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  // By priority
  const byPriority: Record<string, number> = {};
  tickets.forEach((t) => {
    byPriority[t.priorite] = (byPriority[t.priorite] || 0) + 1;
  });

  return {
    total: tickets.length,
    open,
    in_progress: inProgress,
    resolved,
    closed,
    avg_resolution_hours: avgResolutionHours,
    avg_first_response_hours: null,
    avg_satisfaction: avgSatisfaction,
    by_category: byCategory,
    by_priority: byPriority,
  };
}
