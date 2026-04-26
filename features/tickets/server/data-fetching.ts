import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

type Role = "owner" | "tenant" | "provider";

type ProfileSummary = {
  id: string;
  nom: string | null;
  prenom: string | null;
  role: string | null;
};

type ProviderSummary = {
  id: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
};

type PropertySummary = {
  id: string;
  adresse_complete: string | null;
};

type LeaseSummary = {
  id: string;
  date_debut: string | null;
  date_fin: string | null;
  statut: string | null;
};

type WorkOrderRow = {
  id: string;
  ticket_id: string;
  statut: string | null;
  date_intervention_prevue: string | null;
  cout_estime: number | null;
  cout_final: number | null;
  provider: ProviderSummary | null;
};

type EnrichedTicket = Record<string, unknown> & {
  id: string;
  property: PropertySummary | null;
  lease: LeaseSummary | null;
  creator: ProfileSummary | null;
  assignee: ProfileSummary | null;
  work_orders: Array<Omit<WorkOrderRow, "ticket_id">>;
  ticket_comments: Array<Record<string, never>>;
  messages: [{ count: number }];
};

/**
 * getTickets — SSR fetcher for the owner/tenant/provider tickets list.
 *
 * **Design intentionnel (ne pas fusionner en un seul SELECT avec embeds) :**
 * la liste tickets se construit en deux temps :
 *   1. Une requête de base sur `tickets` (filtrée par rôle) pour récupérer
 *      les rows brutes — c'est ce qui détermine la complétude de la liste.
 *   2. Six fetchs parallèles d'hydratation (properties, leases, creator,
 *      assignee, work_orders + provider embed, comment count) qui enrichissent
 *      les rows en mémoire via des Maps id→row.
 *
 * Pourquoi pas un seul SELECT avec embeds Supabase ? Parce qu'une RLS cassée
 * ou récursive sur n'importe quelle table jointe (ex. `properties` via
 * `lease_signers`) blanke alors la requête entière, ce qui se manifeste par
 * un KPI "Ouverts: N" affiché à côté d'un trompeur "Aucun ticket". Les fetchs
 * indépendants isolent ces ratés : si l'hydratation des baux casse, les
 * tickets restent affichés sans `lease`, plutôt que disparaître.
 *
 * Le service-role bypasse la RLS sur les hydratations elles-mêmes — la
 * sécurité est garantie en amont par le filtre métier (par owner_id /
 * created_by_profile_id / work_orders.provider_id).
 *
 * Le provider est embarqué directement dans la requête `work_orders` :
 * c'est sûr car service-role contourne la RLS profiles, et un FK orphelin
 * sur un work_order isole le `null` à cette row sans casser les autres.
 */
export async function getTickets(role: Role): Promise<EnrichedTicket[]> {
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
    .maybeSingle();

  if (!profile) return [];
  const profileId = (profile as { id: string }).id;

  const ticketIdsForRole = await resolveTicketScope(serviceClient, role, profileId);
  if (ticketIdsForRole.kind === "empty") return [];

  let baseQuery = serviceClient
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (ticketIdsForRole.kind === "by_creator") {
    baseQuery = baseQuery.eq("created_by_profile_id", ticketIdsForRole.profileId);
  } else if (ticketIdsForRole.kind === "by_property") {
    baseQuery = baseQuery.in("property_id", ticketIdsForRole.propertyIds);
  } else if (ticketIdsForRole.kind === "by_id") {
    baseQuery = baseQuery.in("id", ticketIdsForRole.ticketIds);
  }

  const { data: base, error } = await baseQuery;

  if (error) {
    console.error("[getTickets] base query error:", error.code, error.message);
    return [];
  }

  const tickets = (base ?? []) as Array<Record<string, unknown> & { id: string }>;
  if (tickets.length === 0) return [];

  const ticketIds = tickets.map((t) => t.id);
  const propertyIds = uniq(tickets.map((t) => t.property_id as string | null).filter(isNonNullString));
  const leaseIds = uniq(tickets.map((t) => t.lease_id as string | null).filter(isNonNullString));
  const creatorIds = uniq(tickets.map((t) => t.created_by_profile_id as string | null).filter(isNonNullString));
  const assigneeIds = uniq(tickets.map((t) => t.assigned_to as string | null).filter(isNonNullString));

  const [propertiesRes, leasesRes, creatorsRes, assigneesRes, workOrdersRes, commentsRes] = await Promise.all([
    safeFetch<PropertySummary>(() =>
      propertyIds.length
        ? serviceClient.from("properties").select("id, adresse_complete").in("id", propertyIds)
        : emptyResult(),
    ),
    safeFetch<LeaseSummary>(() =>
      leaseIds.length
        ? serviceClient.from("leases").select("id, date_debut, date_fin, statut").in("id", leaseIds)
        : emptyResult(),
    ),
    safeFetch<ProfileSummary>(() =>
      creatorIds.length
        ? serviceClient.from("profiles").select("id, nom, prenom, role").in("id", creatorIds)
        : emptyResult(),
    ),
    safeFetch<ProfileSummary>(() =>
      assigneeIds.length
        ? serviceClient.from("profiles").select("id, nom, prenom, role").in("id", assigneeIds)
        : emptyResult(),
    ),
    // provider is embedded directly: service-role bypasses profiles RLS, and a
    // missing/orphan provider FK isolates the null to that single work_order
    // row instead of dropping the whole batch.
    safeFetch<WorkOrderRow>(() =>
      serviceClient
        .from("work_orders")
        .select(
          "id, ticket_id, statut, date_intervention_prevue, cout_estime, cout_final, provider:profiles!provider_id(id, nom, prenom, telephone)",
        )
        .in("ticket_id", ticketIds),
    ),
    safeFetch<{ id: string; ticket_id: string }>(() =>
      serviceClient.from("ticket_comments").select("id, ticket_id").in("ticket_id", ticketIds),
    ),
  ]);

  const propertyMap = indexById(propertiesRes);
  const leaseMap = indexById(leasesRes);
  const creatorMap = indexById(creatorsRes);
  const assigneeMap = indexById(assigneesRes);

  const workOrdersByTicket = new Map<string, Array<Omit<WorkOrderRow, "ticket_id">>>();
  for (const wo of workOrdersRes) {
    const list = workOrdersByTicket.get(wo.ticket_id) ?? [];
    list.push({
      id: wo.id,
      statut: wo.statut,
      date_intervention_prevue: wo.date_intervention_prevue,
      cout_estime: wo.cout_estime,
      cout_final: wo.cout_final,
      provider: wo.provider ?? null,
    });
    workOrdersByTicket.set(wo.ticket_id, list);
  }

  const commentCountByTicket = new Map<string, number>();
  for (const c of commentsRes) {
    commentCountByTicket.set(c.ticket_id, (commentCountByTicket.get(c.ticket_id) ?? 0) + 1);
  }

  return tickets.map((t): EnrichedTicket => {
    const propertyId = (t.property_id as string | null) ?? null;
    const leaseId = (t.lease_id as string | null) ?? null;
    const creatorId = (t.created_by_profile_id as string | null) ?? null;
    const assigneeId = (t.assigned_to as string | null) ?? null;
    const commentCount = commentCountByTicket.get(t.id) ?? 0;

    return {
      ...t,
      property: propertyId ? propertyMap.get(propertyId) ?? null : null,
      lease: leaseId ? leaseMap.get(leaseId) ?? null : null,
      creator: creatorId ? creatorMap.get(creatorId) ?? null : null,
      assignee: assigneeId ? assigneeMap.get(assigneeId) ?? null : null,
      work_orders: workOrdersByTicket.get(t.id) ?? [],
      ticket_comments: new Array(commentCount).fill({}) as Array<Record<string, never>>,
      messages: [{ count: commentCount }],
    };
  });
}

type TicketScope =
  | { kind: "empty" }
  | { kind: "by_creator"; profileId: string }
  | { kind: "by_property"; propertyIds: string[] }
  | { kind: "by_id"; ticketIds: string[] };

async function resolveTicketScope(
  serviceClient: ReturnType<typeof getServiceClient>,
  role: Role,
  profileId: string,
): Promise<TicketScope> {
  if (role === "tenant") {
    return { kind: "by_creator", profileId };
  }

  if (role === "owner") {
    const { data: properties } = await serviceClient
      .from("properties")
      .select("id")
      .eq("owner_id", profileId);

    const propertyIds = ((properties ?? []) as Array<{ id: string }>)
      .map((p) => p.id)
      .filter(isNonNullString);
    if (propertyIds.length === 0) return { kind: "empty" };
    return { kind: "by_property", propertyIds };
  }

  // provider
  const [{ data: jobs }, { data: assigned }] = await Promise.all([
    serviceClient.from("work_orders").select("ticket_id").eq("provider_id", profileId),
    serviceClient.from("tickets").select("id").eq("assigned_to", profileId),
  ]);

  const woTicketIds = ((jobs ?? []) as Array<{ ticket_id: string | null }>)
    .map((j) => j.ticket_id)
    .filter(isNonNullString);
  const assignedIds = ((assigned ?? []) as Array<{ id: string }>)
    .map((t) => t.id)
    .filter(isNonNullString);

  const ticketIds = uniq([...woTicketIds, ...assignedIds]);
  if (ticketIds.length === 0) return { kind: "empty" };
  return { kind: "by_id", ticketIds };
}

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isNonNullString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

async function safeFetch<T>(
  fn: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  try {
    const { data, error } = await fn();
    if (error) {
      const e = error as { code?: string; message?: string };
      console.error("[getTickets] hydration error:", e.code, e.message);
      return [];
    }
    return (data as T[]) ?? [];
  } catch (err) {
    console.error("[getTickets] hydration threw:", err);
    return [];
  }
}

function emptyResult(): Promise<{ data: unknown[]; error: null }> {
  return Promise.resolve({ data: [], error: null });
}

function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const r of rows) {
    if (r && typeof r.id === "string") out.set(r.id, r);
  }
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
    propertyIds = ((properties ?? []) as Array<{ id: string }>).map((p) => p.id);
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

  const propertyIds = ((properties ?? []) as Array<{ id: string }>).map((p) => p.id);

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
