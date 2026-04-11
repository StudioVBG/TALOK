"use client";

import { useQuery } from "@tanstack/react-query";
import type { TenantEDLListItem } from "@/lib/types/tenant";

/**
 * Liste des EDL accessibles au locataire connecté.
 *
 * Délègue à `/api/tenant/inspections` qui utilise `getServiceClient()` côté
 * serveur pour éviter les recursions RLS (42P17) déclenchées par les embeds
 * PostgREST profonds en mode user-scoped.
 */
async function fetchTenantInspections(): Promise<TenantEDLListItem[]> {
  const res = await fetch("/api/tenant/inspections", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const data = (await res.json()) as { inspections?: TenantEDLListItem[] };
  return data.inspections ?? [];
}

export function useTenantInspections() {
  return useQuery({
    queryKey: ["tenant", "inspections"],
    queryFn: fetchTenantInspections,
    staleTime: 60_000,
  });
}
