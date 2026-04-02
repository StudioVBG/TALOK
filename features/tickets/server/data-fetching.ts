import { createClient } from "@/lib/supabase/server";

export async function getTickets(role: "owner" | "tenant" | "provider") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return [];

  let query = supabase
    .from("tickets")
    .select(`
      *,
      property:properties(adresse_complete),
      lease:leases(id, date_debut, date_fin, statut),
      creator:profiles!created_by_profile_id(nom, prenom, role),
      messages:ticket_messages(count),
      work_orders(
        id,
        statut,
        date_intervention_prevue,
        cout_estime,
        cout_final,
        provider:profiles!provider_id(id, nom, prenom, telephone)
      )
    `)
    .order("created_at", { ascending: false });

  if (role === "tenant") {
    // Mes tickets créés
    query = query.eq("created_by_profile_id", profile.id);
  } else if (role === "owner") {
    // Tickets sur mes proprietes — filtre explicite par property_id
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", profile.id);

    const propertyIds = properties?.map(p => p.id) || [];
    if (propertyIds.length === 0) return [];
    query = query.in("property_id", propertyIds);
  } else if (role === "provider") {
    // Tickets lies a mes work_orders
    const { data: jobs } = await supabase
      .from("work_orders")
      .select("ticket_id")
      .eq("provider_id", profile.id);

    const ticketIds = jobs?.map(j => j.ticket_id).filter(Boolean) || [];
    if (ticketIds.length === 0) return [];
    query = query.in("id", ticketIds);
  }

  const { data } = await query;
  return data || [];
}

export async function getTicketDetails(id: string) {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from("tickets")
    .select(`
      *,
      property:properties(adresse_complete, ville, code_postal),
      creator:profiles!created_by_profile_id(nom, prenom, email, telephone),
      messages:ticket_messages(
        id,
        content,
        created_at,
        sender:profiles(id, nom, prenom, role)
      ),
      work_orders(
        id, 
        statut, 
        provider:profiles!provider_id(nom, prenom, telephone)
      )
    `)
    .eq("id", id)
    .single();

  return data;
}
