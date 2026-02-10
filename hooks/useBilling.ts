"use client";

import { useQuery } from "@tanstack/react-query";
import type { BillingData } from "@/types/billing";

export function useBilling() {
  return useQuery<BillingData>({
    queryKey: ["billing"],
    queryFn: async () => {
      const res = await fetch("/api/billing");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors du chargement de la facturation");
      }
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
