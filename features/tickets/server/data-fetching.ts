import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

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

  // 1) Aggregated counts + averages come from the v_tickets_kpis_owner view
  //    (security_invoker: RLS applies through the owner's profile).
  //    For admins we aggregate across all owners below.
  type ViewRow = {
    owner_id: string;
    open_count: number | null;
    in_progress_count: number | null;
    resolved_count: number | null;
    closed_count: number | null;
    avg_resolution_hours: number | null;
    avg_satisfaction: number | null;
  };

  let viewRow: ViewRow | null = null;

  if (profile.role === "owner") {
    const { data } = await (serviceClient as any)
      .from("v_tickets_kpis_owner")
      .select("*")
      .eq("owner_id", profile.id)
      .maybeSingle();
    viewRow = (data as ViewRow | null) ?? null;
  } else {
    // admin : sum across all rows
    const { data } = await (serviceClient as any).from("v_tickets_kpis_owner").select("*");
    const rows = (data || []) as ViewRow[];
    if (rows.length > 0) {
      const sum = (k: keyof ViewRow) =>
        rows.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
      viewRow = {
        owner_id: "__admin__",
        open_count: sum("open_count"),
        in_progress_count: sum("in_progress_count"),
        resolved_count: sum("resolved_count"),
        closed_count: sum("closed_count"),
        // Weighted averages are out of scope here — keep the simple mean
        // of non-null per-owner averages to stay cheap.
        avg_resolution_hours: avgOfNumbers(rows.map((r) => r.avg_resolution_hours)),
        avg_satisfaction: avgOfNumbers(rows.map((r) => r.avg_satisfaction)),
      };
    }
  }

  // 2) by_category / by_priority still need a lightweight grouping
  //    (not exposed by the view). We fetch only the 2 columns we need.
  let catPrioQuery = (serviceClient as any).from("tickets").select("priorite, category");
  if (propertyIds.length > 0) {
    catPrioQuery = catPrioQuery.in("property_id", propertyIds);
  }
  const { data: grouping } = await catPrioQuery;
  const rows = (grouping || []) as Array<{ priorite: string; category: string | null }>;

  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const r of rows) {
    const cat = r.category || "non_categorise";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    byPriority[r.priorite] = (byPriority[r.priorite] || 0) + 1;
  }

  const open = Number(viewRow?.open_count ?? 0);
  const inProgress = Number(viewRow?.in_progress_count ?? 0);
  const resolved = Number(viewRow?.resolved_count ?? 0);
  const closed = Number(viewRow?.closed_count ?? 0);

  return {
    total: rows.length,
    open,
    in_progress: inProgress,
    resolved,
    closed,
    avg_resolution_hours:
      viewRow?.avg_resolution_hours !== null && viewRow?.avg_resolution_hours !== undefined
        ? Math.round(Number(viewRow.avg_resolution_hours))
        : null,
    avg_first_response_hours: null,
    avg_satisfaction:
      viewRow?.avg_satisfaction !== null && viewRow?.avg_satisfaction !== undefined
        ? Number(viewRow.avg_satisfaction)
        : null,
    by_category: byCategory,
    by_priority: byPriority,
  };
}

function avgOfNumbers(values: Array<number | null>): number | null {
  const nums = values
    .map((v) => (v === null || v === undefined ? null : Number(v)))
    .filter((v): v is number => v !== null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

/**
 * Compteurs pour les cartes "Actions rapides" du dashboard tickets owner.
 * - workOrdersInProgress: travaux non termines/annules sur les biens du proprietaire
 * - providersAvailable: prestataires actifs et verifies dans la marketplace
 */
export async function getTicketsActionStats(): Promise<{
  workOrdersInProgress: number;
  providersAvailable: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { workOrdersInProgress: 0, providersAvailable: 0 };

  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { workOrdersInProgress: 0, providersAvailable: 0 };

  const { data: properties } = await serviceClient
    .from("properties")
    .select("id")
    .eq("owner_id", (profile as { id: string }).id);

  const propertyIds = (properties || []).map((p) => (p as { id: string }).id);

  const [woResult, provResult] = await Promise.all([
    propertyIds.length === 0
      ? Promise.resolve({ count: 0 })
      : (serviceClient as any)
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .in("property_id", propertyIds)
          .not("statut", "in", "(done,cancelled)"),
    (serviceClient as any)
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("is_verified", true),
  ]);

  return {
    workOrdersInProgress: (woResult as { count: number | null }).count ?? 0,
    providersAvailable: (provResult as { count: number | null }).count ?? 0,
  };
}
