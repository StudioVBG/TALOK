import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { TICKET_OPEN_STATUSES } from "@/lib/tickets/statuses";

/**
 * getTickets — SSR fetcher for the owner/tenant/provider tickets list.
 *
 * Fetches tickets with a minimal base query, then hydrates joined relations
 * (property, lease, creator, assignee, work_orders + provider, comment count)
 * separately. This prevents a single broken embed / RLS recursion on any
 * related table from blanking the whole list (previously surfaced as a
 * "Ouverts: N" KPI alongside a misleading "Aucun ticket" empty state).
 */
export async function getTickets(role: "owner" | "tenant" | "provider") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient.from("profiles").select("id").eq("user_id", user.id).single();

  if (!profile) return [];

  let baseQuery = (serviceClient as any).from("tickets").select("*").order("created_at", { ascending: false });

  if (role === "tenant") {
    baseQuery = baseQuery.eq("created_by_profile_id", profile.id);
  } else if (role === "owner") {
    const { data: properties } = await serviceClient.from("properties").select("id").eq("owner_id", profile.id);

    const propertyIds = (properties || []).map((p) => (p as { id: string }).id);
    if (propertyIds.length === 0) return [];
    baseQuery = baseQuery.in("property_id", propertyIds);
  } else if (role === "provider") {
    const { data: jobs } = await serviceClient.from("work_orders").select("ticket_id").eq("provider_id", profile.id);

    const woTicketIds = (jobs || [])
      .map((j) => (j as { ticket_id: string | null }).ticket_id)
      .filter((id): id is string => Boolean(id));

    const { data: assigned } = await serviceClient.from("tickets").select("id").eq("assigned_to", profile.id);

    const assignedIds = (assigned || []).map((t) => (t as { id: string }).id);

    const allIds = [...new Set([...woTicketIds, ...assignedIds])];
    if (allIds.length === 0) return [];
    baseQuery = baseQuery.in("id", allIds);
  }

  const { data: base, error } = await baseQuery;

  if (error) {
    console.error("[getTickets] base query error:", error.code, error.message);
    return [];
  }

  const tickets = (base || []) as Array<Record<string, any>>;
  if (tickets.length === 0) return [];

  const ticketIds = tickets.map((t) => t.id as string);
  const propertyIds = uniq(tickets.map((t) => t.property_id).filter(Boolean));
  const leaseIds = uniq(tickets.map((t) => t.lease_id).filter(Boolean));
  const creatorIds = uniq(tickets.map((t) => t.created_by_profile_id).filter(Boolean));
  const assigneeIds = uniq(tickets.map((t) => t.assigned_to).filter(Boolean));

  const [propertiesRes, leasesRes, creatorsRes, assigneesRes, workOrdersRes, commentsRes] = await Promise.all([
    safeFetch(() =>
      propertyIds.length
        ? serviceClient.from("properties").select("id, adresse_complete").in("id", propertyIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ),
    safeFetch(() =>
      leaseIds.length
        ? serviceClient.from("leases").select("id, date_debut, date_fin, statut").in("id", leaseIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ),
    safeFetch(() =>
      creatorIds.length
        ? serviceClient.from("profiles").select("id, nom, prenom, role").in("id", creatorIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ),
    safeFetch(() =>
      assigneeIds.length
        ? serviceClient.from("profiles").select("id, nom, prenom, role").in("id", assigneeIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ),
    safeFetch(() =>
      serviceClient
        .from("work_orders")
        .select("id, ticket_id, statut, date_intervention_prevue, cout_estime, cout_final, provider_id")
        .in("ticket_id", ticketIds),
    ),
    safeFetch(() => serviceClient.from("ticket_comments").select("id, ticket_id").in("ticket_id", ticketIds)),
  ]);

  const providerIds = uniq((workOrdersRes as any[]).map((w) => w.provider_id).filter(Boolean));
  const providersRes = await safeFetch(() =>
    providerIds.length
      ? serviceClient.from("profiles").select("id, nom, prenom, telephone").in("id", providerIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  );

  const propertyMap = indexById(propertiesRes);
  const leaseMap = indexById(leasesRes);
  const creatorMap = indexById(creatorsRes);
  const assigneeMap = indexById(assigneesRes);
  const providerMap = indexById(providersRes);

  const workOrdersByTicket: Record<string, any[]> = {};
  (workOrdersRes as any[]).forEach((wo) => {
    if (!workOrdersByTicket[wo.ticket_id]) workOrdersByTicket[wo.ticket_id] = [];
    workOrdersByTicket[wo.ticket_id].push({
      id: wo.id,
      statut: wo.statut,
      date_intervention_prevue: wo.date_intervention_prevue,
      cout_estime: wo.cout_estime,
      cout_final: wo.cout_final,
      provider: wo.provider_id ? providerMap[wo.provider_id] || null : null,
    });
  });

  const commentCountByTicket: Record<string, number> = {};
  (commentsRes as any[]).forEach((c) => {
    commentCountByTicket[c.ticket_id] = (commentCountByTicket[c.ticket_id] || 0) + 1;
  });

  return tickets.map((t) => ({
    ...t,
    property: t.property_id ? propertyMap[t.property_id] || null : null,
    lease: t.lease_id ? leaseMap[t.lease_id] || null : null,
    creator: t.created_by_profile_id ? creatorMap[t.created_by_profile_id] || null : null,
    assignee: t.assigned_to ? assigneeMap[t.assigned_to] || null : null,
    work_orders: workOrdersByTicket[t.id] || [],
    ticket_comments: new Array(commentCountByTicket[t.id] || 0).fill({}),
    messages: [{ count: commentCountByTicket[t.id] || 0 }],
  }));
}

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

async function safeFetch(fn: () => PromiseLike<{ data: any; error: unknown }>): Promise<any[]> {
  try {
    const { data, error } = await fn();
    if (error) {
      const e = error as { code?: string; message?: string };
      console.error("[getTickets] hydration error:", e.code, e.message);
      return [];
    }
    return (data as any[]) || [];
  } catch (err) {
    console.error("[getTickets] hydration threw:", err);
    return [];
  }
}

function indexById(rows: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  rows.forEach((r) => {
    if (r && typeof r.id === "string") out[r.id] = r;
  });
  return out;
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
    `,
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

  const { data: profile } = await serviceClient.from("profiles").select("id, role").eq("user_id", user.id).single();

  if (!profile) return null;

  let propertyIds: string[] = [];

  if (profile.role === "owner") {
    const { data: properties } = await serviceClient.from("properties").select("id").eq("owner_id", profile.id);
    propertyIds = (properties || []).map((p) => (p as { id: string }).id) || [];
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

  const open = tickets.filter((t) => (TICKET_OPEN_STATUSES as readonly string[]).includes(t.statut)).length;
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
      ? Math.round((rated.reduce((s: number, t) => s + (t.satisfaction_rating ?? 0), 0) / rated.length) * 10) / 10
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
