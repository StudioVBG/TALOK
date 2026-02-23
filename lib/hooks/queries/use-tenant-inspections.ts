"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TenantEDLListItem, TenantEDLSignatureWithDetails } from "@/lib/types/tenant";

async function fetchTenantInspections(): Promise<TenantEDLListItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return [];

  const { data: signatures, error } = await supabase
    .from("edl_signatures")
    .select(`
      *,
      edl:edl_id(
        *,
        lease:lease_id(*, property:properties(*)),
        property_details:property_id(*)
      )
    `)
    .eq("signer_profile_id", profile.id);

  if (error) throw new Error(error.message);

  const formatted = (signatures as unknown as TenantEDLSignatureWithDetails[] | null)
    ?.filter(
      (sig): sig is TenantEDLSignatureWithDetails & { edl: NonNullable<TenantEDLSignatureWithDetails["edl"]> } =>
        sig.edl !== null && sig.edl !== undefined
    )
    .map((sig) => ({
      id: sig.edl.id,
      type: sig.edl.type as "entree" | "sortie",
      status: sig.edl.status,
      scheduled_at: sig.edl.scheduled_at ?? null,
      created_at: sig.edl.created_at,
      invitation_token: sig.invitation_token,
      property: sig.edl.lease?.property || sig.edl.property_details || null,
      isSigned: !!sig.signed_at,
      needsMySignature: !sig.signed_at && sig.edl.status !== "draft",
    })) || [];

  return formatted.sort((a, b) => (b.needsMySignature ? 1 : 0) - (a.needsMySignature ? 1 : 0));
}

export function useTenantInspections() {
  return useQuery({
    queryKey: ["tenant", "inspections"],
    queryFn: fetchTenantInspections,
  });
}
