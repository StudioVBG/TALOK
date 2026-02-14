import { createClient } from "@/lib/supabase/server";
import type { InvoiceRow, ProfileRow } from "@/lib/supabase/database.types";

export async function fetchTenantInvoices(userId: string): Promise<InvoiceRow[]> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single() as { data: Pick<ProfileRow, "id"> | null; error: Error | null };

  if (!profile) return [];

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", profile.id)
    .order("periode", { ascending: false }) as { data: InvoiceRow[] | null; error: Error | null };

  return invoices || [];
}
