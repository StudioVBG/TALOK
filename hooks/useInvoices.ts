"use client";

import { useQuery } from "@tanstack/react-query";
import type { InvoicesResponse } from "@/types/billing";

export function useInvoices(cursor?: string | null) {
  return useQuery<InvoicesResponse>({
    queryKey: ["invoices", cursor ?? "first"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cursor) params.set("starting_after", cursor);
      const res = await fetch(`/api/billing/invoices?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors du chargement des factures");
      }
      return res.json();
    },
    staleTime: 60_000,
  });
}
