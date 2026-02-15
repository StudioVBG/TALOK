/**
 * Data fetching pour les tickets (Owner)
 * Server-side uniquement
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { TicketRow as _TicketRowBase, PropertyRow, ProfileRow } from "@/lib/supabase/database.types";

export interface TicketRow {
  id: string;
  property_id: string;
  lease_id: string | null;
  created_by_profile_id: string;
  titre: string;
  description: string;
  priorite: "basse" | "normale" | "haute";
  statut: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
}

export interface FetchTicketsOptions {
  ownerId: string;
  propertyId?: string;
  leaseId?: string;
  status?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}

export interface TicketsWithPagination {
  tickets: TicketRow[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Récupère les tickets d'un propriétaire
 */
export async function fetchTickets(
  options: FetchTicketsOptions
): Promise<TicketsWithPagination> {
  const supabase = await createClient();

  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Vérifier les permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  const profileData = profile as ProfileRow | null;
  if (!profileData || profileData.role !== "owner" || profileData.id !== options.ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Récupérer les propriétés du propriétaire
  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", options.ownerId);

  if (!properties || properties.length === 0) {
    return {
      tickets: [],
      total: 0,
      page: 1,
      limit: options.limit || 50,
    };
  }

  const propertyIds = properties.map((p) => p.id);

  // Construire la requête
  let query = supabase
    .from("tickets")
    .select("*", { count: "exact" })
    .in("property_id", propertyIds)
    .order("created_at", { ascending: false });

  // Filtrer par propriété si spécifié
  if (options.propertyId) {
    query = query.eq("property_id", options.propertyId);
  }

  // Filtrer par bail si spécifié
  if (options.leaseId) {
    query = query.eq("lease_id", options.leaseId);
  }

  // Filtrer par statut si spécifié
  if (options.status) {
    query = query.eq("statut", options.status);
  }

  // Filtrer par priorité si spécifié
  if (options.priority) {
    query = query.eq("priorite", options.priority);
  }

  // Pagination
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data: tickets, error, count } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des tickets: ${error.message}`);
  }

  return {
    tickets: (tickets || []) as TicketRow[],
    total: count || 0,
    page: Math.floor(offset / limit) + 1,
    limit,
  };
}

/**
 * Récupère un ticket par ID
 */
export async function fetchTicket(
  ticketId: string,
  ownerId: string
): Promise<TicketRow | null> {
  const supabase = await createClient();

  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Vérifier les permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  const profileData = profile as ProfileRow | null;
  if (!profileData || profileData.role !== "owner" || profileData.id !== ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Vérifier que le ticket appartient à une propriété du propriétaire
  type TicketWithProperty = TicketRow & {
    properties: PropertyRow;
  };
  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("*, properties!inner(owner_id)")
    .eq("id", ticketId)
    .single();

  if (ticketError) {
    if (ticketError.code === "PGRST116") {
      return null;
    }
    throw new Error(`Erreur lors de la récupération du ticket: ${ticketError.message}`);
  }

  const ticketData = ticket as TicketWithProperty;

  // Vérifier que la propriété appartient au propriétaire
  const property = ticketData.properties;
  if (!property || property.owner_id !== ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Retourner le ticket sans la relation
  const { properties: _, ...ticketWithoutProperty } = ticketData;
  return ticketWithoutProperty as TicketRow;
}

