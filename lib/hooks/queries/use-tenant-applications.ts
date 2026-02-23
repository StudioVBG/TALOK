"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

interface ApplicationWithProperty {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  rejection_reason?: string | null;
  property?: {
    id: string;
    adresse_complete?: string;
    ville?: string;
    type?: string;
  } | null;
}

async function fetchTenantApplications(): Promise<ApplicationWithProperty[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return [];

  const { data, error } = await supabase
    .from("tenant_applications")
    .select(`
      id,
      status,
      created_at,
      updated_at,
      rejection_reason,
      property:properties(id, adresse_complete, ville, type)
    `)
    .eq("tenant_profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data as unknown as ApplicationWithProperty[]) || [];
}

export function useTenantApplications() {
  return useQuery({
    queryKey: ["tenant", "applications"],
    queryFn: fetchTenantApplications,
  });
}
