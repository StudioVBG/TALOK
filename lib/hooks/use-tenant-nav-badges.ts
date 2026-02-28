"use client";

import { useQuery } from "@tanstack/react-query";

interface NavBadges {
  messages: number;
  requests: number;
}

async function fetchNavBadges(): Promise<NavBadges> {
  const res = await fetch("/api/tenant/nav-badges");
  if (!res.ok) return { messages: 0, requests: 0 };
  return res.json();
}

/**
 * Lightweight hook for sidebar notification badges.
 * Polls every 60s to keep counts fresh without WebSocket overhead.
 */
export function useTenantNavBadges() {
  const { data } = useQuery({
    queryKey: ["tenant", "nav-badges"],
    queryFn: fetchNavBadges,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    messages: data?.messages ?? 0,
    requests: data?.requests ?? 0,
  };
}
