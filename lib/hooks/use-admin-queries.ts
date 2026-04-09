"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Query Keys ────────────────────────────────────────────
export const adminKeys = {
  all: ["admin"] as const,
  stats: () => [...adminKeys.all, "stats"] as const,
  auditLogs: (filters?: Record<string, string>) =>
    [...adminKeys.all, "audit-logs", filters] as const,
  moderationQueue: (filters?: Record<string, string>) =>
    [...adminKeys.all, "moderation", "queue", filters] as const,
  plans: () => [...adminKeys.all, "plans"] as const,
  subscriptions: (filters?: Record<string, string>) =>
    [...adminKeys.all, "subscriptions", filters] as const,
  subscriptionStats: () => [...adminKeys.all, "subscriptions", "stats"] as const,
  users: (filters?: Record<string, string>) =>
    [...adminKeys.all, "users", filters] as const,
  user: (id: string) => [...adminKeys.all, "users", id] as const,
  supportTickets: (filters?: Record<string, string>) =>
    [...adminKeys.all, "support-tickets", filters] as const,
  featureFlags: () => [...adminKeys.all, "feature-flags"] as const,
  metrics: () => [...adminKeys.all, "metrics"] as const,
};

// ─── Generic fetch helper ──────────────────────────────────
async function adminFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function adminMutate<T>(
  url: string,
  method: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Stats ─────────────────────────────────────────────────
export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => adminFetch<Record<string, unknown>>("/api/admin/stats"),
    staleTime: 60_000, // 1 min
    refetchInterval: 5 * 60_000, // Auto-refresh every 5 min
  });
}

// ─── Audit Logs ────────────────────────────────────────────
interface AuditLogsResponse {
  logs: unknown[];
  total: number;
  limit: number;
  offset: number;
}

export function useAuditLogs(filters: {
  limit?: number;
  offset?: number;
  risk_level?: string;
  entity_type?: string;
  user_id?: string;
}) {
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  if (filters.risk_level && filters.risk_level !== "all")
    params.set("risk_level", filters.risk_level);
  if (filters.entity_type && filters.entity_type !== "all")
    params.set("entity_type", filters.entity_type);
  if (filters.user_id) params.set("user_id", filters.user_id);

  return useQuery({
    queryKey: adminKeys.auditLogs(Object.fromEntries(params)),
    queryFn: () =>
      adminFetch<AuditLogsResponse>(`/api/admin/audit-logs?${params}`),
    staleTime: 30_000,
  });
}

// ─── Moderation Queue ──────────────────────────────────────
interface ModerationQueueResponse {
  items: unknown[];
  total: number;
}

export function useModerationQueue(filters: {
  status?: string;
  priority?: string;
  entity_type?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.entity_type) params.set("entity_type", filters.entity_type);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));

  return useQuery({
    queryKey: adminKeys.moderationQueue(Object.fromEntries(params)),
    queryFn: () =>
      adminFetch<ModerationQueueResponse>(
        `/api/admin/moderation/queue?${params}`
      ),
    staleTime: 30_000,
    refetchInterval: 60_000, // Refresh moderation queue every minute
  });
}

// ─── Plans ─────────────────────────────────────────────────
interface PlansResponse {
  plans: unknown[];
}

export function useAdminPlans() {
  return useQuery({
    queryKey: adminKeys.plans(),
    queryFn: () => adminFetch<PlansResponse>("/api/admin/plans"),
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      adminMutate<unknown>("/api/admin/plans", "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.plans() });
    },
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      adminMutate<unknown>("/api/admin/plans", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.plans() });
    },
  });
}

// ─── Subscriptions ─────────────────────────────────────────
interface SubscriptionStatsResponse {
  stats: unknown;
}

export function useSubscriptionStats() {
  return useQuery({
    queryKey: adminKeys.subscriptionStats(),
    queryFn: () =>
      adminFetch<SubscriptionStatsResponse>("/api/admin/subscriptions/stats"),
    staleTime: 60_000,
  });
}

// ─── User mutations ────────────────────────────────────────
export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      suspended,
      reason,
    }: {
      userId: string;
      suspended: boolean;
      reason?: string;
    }) =>
      adminMutate<unknown>(`/api/admin/users/${userId}`, "PATCH", {
        suspended,
        reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

// ─── Subscription actions ──────────────────────────────────
export function useOverridePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      user_id: string;
      target_plan: string;
      reason: string;
      notify_user?: boolean;
    }) =>
      adminMutate<unknown>("/api/admin/subscriptions/override", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminKeys.subscriptions(),
      });
      queryClient.invalidateQueries({
        queryKey: adminKeys.subscriptionStats(),
      });
    },
  });
}

export function useSuspendSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      user_id: string;
      reason: string;
      notify_user?: boolean;
    }) =>
      adminMutate<unknown>("/api/admin/subscriptions/suspend", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminKeys.subscriptions(),
      });
    },
  });
}

// ─── Support Tickets ──────────────────────────────────────
interface SupportTicketsResponse {
  tickets: unknown[];
  total: number;
  stats: {
    total: number;
    open: number;
    in_progress: number;
    waiting: number;
    resolved: number;
    closed: number;
    urgent: number;
    high: number;
  };
}

export function useSupportTickets(filters: {
  status?: string;
  priority?: string;
  page?: number;
  per_page?: number;
}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all")
    params.set("status", filters.status);
  if (filters.priority && filters.priority !== "all")
    params.set("priority", filters.priority);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.per_page) params.set("per_page", String(filters.per_page));

  return useQuery({
    queryKey: adminKeys.supportTickets(Object.fromEntries(params)),
    queryFn: () =>
      adminFetch<SupportTicketsResponse>(`/api/admin/support?${params}`),
    staleTime: 30_000,
  });
}

export function useUpdateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: string;
      status?: string;
      priority?: string;
      assigned_to?: string | null;
    }) => adminMutate<unknown>("/api/admin/support", "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminKeys.supportTickets(),
      });
    },
  });
}

// ─── Feature Flags ────────────────────────────────────────
interface FeatureFlagsResponse {
  flags: Array<{
    id: string;
    name: string;
    enabled: boolean;
    rollout_percentage: number;
    description: string | null;
    updated_by: string | null;
    updated_at: string;
    created_at: string;
  }>;
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: adminKeys.featureFlags(),
    queryFn: () => adminFetch<FeatureFlagsResponse>("/api/admin/flags"),
    staleTime: 30_000,
  });
}

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      enabled?: boolean;
      rollout_percentage?: number;
      description?: string;
    }) => adminMutate<unknown>(`/api/admin/flags/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.featureFlags() });
    },
  });
}

export function useCreateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      enabled?: boolean;
      rollout_percentage?: number;
    }) => adminMutate<unknown>("/api/admin/flags", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.featureFlags() });
    },
  });
}

export function useDeleteFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminMutate<unknown>(`/api/admin/flags/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.featureFlags() });
    },
  });
}

// ─── Metrics ──────────────────────────────────────────────
interface MetricsResponse {
  signupsByDay: Record<string, number>;
  signupsByRole: Record<string, number>;
  totalByRole: Record<string, number>;
  newProperties: number;
  activeLeases: number;
  totalLeases: number;
  paymentStats: {
    total_volume: number;
    paid_volume: number;
    count: number;
    paid_count: number;
  };
  openTickets: number;
  totalUsers: number;
  payingUsers: number;
  conversionRate: number;
  signupsChart: Array<{ month: string; inscriptions: number }>;
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: adminKeys.metrics(),
    queryFn: () => adminFetch<MetricsResponse>("/api/admin/metrics"),
    staleTime: 5 * 60_000,
  });
}

// ─── Admin Users List ─────────────────────────────────────
interface AdminUsersResponse {
  users: Array<{
    id: string;
    user_id: string;
    role: string;
    prenom: string | null;
    nom: string | null;
    email: string | null;
    telephone: string | null;
    avatar_url: string | null;
    suspended?: boolean;
    created_at: string;
  }>;
  total: number;
}

export function useAdminUsers(filters: {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  per_page?: number;
}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.role && filters.role !== "all") params.set("role", filters.role);
  if (filters.status && filters.status !== "all")
    params.set("status", filters.status);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.per_page) params.set("per_page", String(filters.per_page));

  return useQuery({
    queryKey: adminKeys.users(Object.fromEntries(params)),
    queryFn: () =>
      adminFetch<AdminUsersResponse>(`/api/admin/users?${params}`),
    staleTime: 30_000,
  });
}
