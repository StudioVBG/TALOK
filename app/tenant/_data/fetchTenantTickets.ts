import { createClient } from "@/lib/supabase/server";
import type { TicketRow, PropertyRow, LeaseRow, WorkOrderRow, ProfileRow } from "@/lib/supabase/database.types";

type TicketWithRelations = TicketRow & {
  property: Pick<PropertyRow, "id" | "adresse_complete" | "ville"> | null;
  lease: Pick<LeaseRow, "id" | "type_bail"> | null;
  work_orders: WorkOrderRow[];
};

export async function fetchTenantTickets(userId: string): Promise<TicketWithRelations[]> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single() as { data: Pick<ProfileRow, "id"> | null; error: Error | null };

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
    .order("created_at", { ascending: false }) as { data: TicketWithRelations[] | null; error: Error | null };

  return tickets || [];
}
