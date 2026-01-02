// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

export async function fetchTenantTickets(userId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!profile) return [];

  const { data: tickets } = await supabase
    .from("tickets")
    .select(`
      *,
      property:properties (
        id,
        adresse_complete,
        ville
      ),
      lease:leases (
        id,
        type_bail
      ),
      work_orders(*)
    `)
    .eq("created_by_profile_id", profile.id)
    .order("created_at", { ascending: false });

  return tickets || [];
}
