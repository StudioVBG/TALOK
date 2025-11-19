import { createClient } from "@/lib/supabase/server";

export async function fetchTenantInvoices(userId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!profile) return [];

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", profile.id)
    .order("periode", { ascending: false });

  return invoices || [];
}
