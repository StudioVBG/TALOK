"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface WhiteLabelConfig {
  id: string;
  agency_profile_id: string;
  entity_id: string;
  brand_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string | null;
  font_family: string;
  custom_domain: string | null;
  subdomain: string | null;
  domain_verified: boolean;
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  carte_g_number: string;
  carte_g_expiry: string | null;
  caisse_garantie: string | null;
  caisse_garantie_montant: number | null;
  rcp_assurance: string | null;
  show_powered_by_talok: boolean;
  custom_email_sender: string | null;
  custom_email_domain_verified: boolean;
  status: "setup" | "active" | "suspended";
}

async function fetchConfig(): Promise<WhiteLabelConfig | null> {
  const res = await fetch("/api/whitelabel/config");
  if (!res.ok) throw new Error("Failed to fetch config");
  const data = await res.json();
  return data.config;
}

async function updateConfig(updates: Partial<WhiteLabelConfig>): Promise<WhiteLabelConfig> {
  const res = await fetch("/api/whitelabel/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update config");
  }
  const data = await res.json();
  return data.config;
}

async function verifyDomain(): Promise<{
  verified: boolean;
  domain: string;
  error?: string;
  instructions?: { type: string; host: string; value: string; ttl: number };
}> {
  const res = await fetch("/api/whitelabel/domain/verify", { method: "POST" });
  if (!res.ok) throw new Error("Failed to verify domain");
  return res.json();
}

export function useWhiteLabelConfig() {
  const queryClient = useQueryClient();

  const {
    data: config,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["whitelabel-config"],
    queryFn: fetchConfig,
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: (data) => {
      queryClient.setQueryData(["whitelabel-config"], data);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: verifyDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelabel-config"] });
    },
  });

  return {
    config,
    isLoading,
    error,
    updateConfig: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    verifyDomain: verifyMutation.mutateAsync,
    isVerifying: verifyMutation.isPending,
  };
}
