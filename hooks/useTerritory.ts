"use client";

import { useQuery } from "@tanstack/react-query";
import type { Territoire } from "@/types/billing";
import { getTvaRate, getTvaLabel } from "@/lib/billing-utils";

interface TerritoryData {
  territoire: Territoire;
  tva_taux: number;
  label: string;
}

export function useTerritory(): TerritoryData & { isLoading: boolean } {
  const { data, isLoading } = useQuery<{ territoire: Territoire }>({
    queryKey: ["territory"],
    queryFn: async () => {
      const res = await fetch("/api/billing");
      if (!res.ok) return { territoire: "metropole" as Territoire };
      const billing = await res.json();
      return { territoire: billing.subscription?.territoire ?? "metropole" };
    },
    staleTime: 300_000,
  });

  const territoire = data?.territoire ?? "metropole";

  return {
    territoire,
    tva_taux: getTvaRate(territoire),
    label: getTvaLabel(territoire),
    isLoading,
  };
}
