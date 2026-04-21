import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { TICKET_OPEN_STATUSES } from "@/lib/tickets/statuses";

/**
 * getTickets — SSR fetcher for the owner/tenant/provider tickets list.
 *
 * Auth via user-scoped client, DB reads via service client to avoid RLS
 * recursion (42P17) on profiles/tickets that otherwise silently returns an
 * empty array (producing the faux "Aucun ticket" empty state).
 */
export async function getTickets(role: "owner" | "tenant" | "provider") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return [];

  let query = (serviceClient as any)
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
    `,
    )
    .order("created_at", { ascending: false });

  if (role === "tenant") {
    query = query.eq("created_by_profile_id", profile.id);
  } else if (role === "owner") {
    const { data: properties } = await serviceClient
      .from("properties")
      .select("id")
      .eq("owner_id", profile.id);

    const propertyIds = (properties || []).map((p) => (p as { id: string }).id);
    if (propertyIds.length === 0) return [];
    query = query.in("property_id", propertyIds);
  } else if (role === "provider") {
    // Tickets assigned directly OR through work_orders
    const { data: jobs } = await serviceClient
      .from("work_orders")
      .select("ticket_id")
      .eq("provider_id", profile.id);

    const woTicketIds =
      (jobs || [])
        .map((j) => (j as { ticket_id: string | null }).ticket_id)
        .filter((id): id is string => Boolean(id)) || [];

    const { data: assigned } = await serviceClient
      .from("tickets")
      .select("id")
      .eq("assigned_to", profile.id);

    const assignedIds = (assigned || []).map((t) => (t as { id: string }).id);

    const allIds = [...new Set([...woTicketIds, ...assignedIds])];
    if (allIds.length === 0) return [];
    query = query.in("id", allIds);
  }

  const { data, error } = await query;

  if (error) {
    // RLS infinite recursion (42P17) shouldn't happen anymore since we use
    // the service client, but keep the safety net so any regression surfaces
    // in logs instead of crashing the SSR render.
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
  const serviceClient = getServiceClient();
  const { data, error } = await (serviceClient as any)
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

  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) return null;

  let propertyIds: string[] = [];

  if (profile.role === "owner") {
    const { data: properties } = await serviceClient
      .from("properties")
      .select("id")
      .eq("owner_id", profile.id);
    propertyIds =
      (properties || []).map((p) => (p as { id: string }).id) || [];
    if (propertyIds.length === 0) return null;
  } else if (profile.role !== "admin") {
    return null;
  }

  let query = (serviceClient as any)
    .from("tickets")
    .select("id, statut, priorite, category, created_at, resolved_at, satisfaction_rating");

  if (propertyIds.length > 0) {
    query = query.in("property_id", propertyIds);
  }

  const { data: ticketsRaw } = await query;
  if (!ticketsRaw) return null;

  type TicketKPIRow = {
    id: string;
    statut: string;
    priorite: string;
    category: string | null;
    created_at: string;
    resolved_at: string | null;
    satisfaction_rating: number | null;
  };
  const tickets = ticketsRaw as TicketKPIRow[];

  const open = tickets.filter((t) =>
    (TICKET_OPEN_STATUSES as readonly string[]).includes(t.statut)
  ).length;
  const inProgress = tickets.filter((t) => t.statut === "in_progress").length;
  const resolved = tickets.filter((t) => t.statut === "resolved").length;
  const closed = tickets.filter((t) => t.statut === "closed").length;

  // Average resolution time
  const resolvedTickets = tickets.filter((t) => t.resolved_at);
  let avgResolutionHours: number | null = null;
  if (resolvedTickets.length > 0) {
    const totalHours = resolvedTickets.reduce((sum: number, t) => {
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
          (rated.reduce((s: number, t) => s + (t.satisfaction_rating ?? 0), 0) /
            rated.length) * 10
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
