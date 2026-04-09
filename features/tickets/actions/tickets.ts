"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// --- Schemas ---

const createTicketSchema = z.object({
  title: z.string().min(3, "Titre trop court"),
  description: z.string().min(10, "Description trop courte"),
  priority: z.enum(["low", "normal", "urgent", "emergency", "basse", "normale", "haute", "urgente"]),
  category: z.enum([
    "plomberie", "electricite", "serrurerie", "chauffage", "humidite",
    "nuisibles", "bruit", "parties_communes", "equipement", "autre",
  ]).optional().nullable(),
  property_id: z.string().uuid().optional(),
  lease_id: z.string().uuid().optional(),
});

const updateTicketSchema = z.object({
  id: z.string().uuid(),
  statut: z.enum([
    "open", "acknowledged", "assigned", "in_progress",
    "resolved", "closed", "rejected", "reopened",
  ]),
});

const createCommentSchema = z.object({
  ticket_id: z.string().uuid(),
  content: z.string().min(1, "Message vide"),
  is_internal: z.boolean().optional(),
  attachments: z.array(z.string()).optional(),
});

// --- Actions ---

export async function createTicketAction(formData: z.infer<typeof createTicketSchema>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Non authentifié" };

  const validation = createTicketSchema.safeParse(formData);
  if (!validation.success) return { error: "Données invalides" };

  const { title, description, priority, category, property_id, lease_id } = validation.data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: "Profil introuvable" };

  // Resolve property_id from lease if needed
  let finalPropertyId = property_id;
  if (!finalPropertyId && lease_id) {
    const { data: lease } = await supabase
      .from("leases")
      .select("property_id")
      .eq("id", lease_id)
      .single();
    if (lease) finalPropertyId = lease.property_id ?? undefined;
  }

  // Get owner_id from property
  let ownerId: string | undefined;
  if (finalPropertyId) {
    const { data: property } = await supabase
      .from("properties")
      .select("owner_id")
      .eq("id", finalPropertyId)
      .single();
    if (property) ownerId = property.owner_id;
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      created_by_profile_id: profile.id,
      titre: title,
      description,
      priorite: priority,
      category: category || null,
      statut: "open",
      property_id: finalPropertyId,
      lease_id: lease_id,
      owner_id: ownerId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating ticket:", error);
    return { error: "Erreur lors de la création" };
  }

  revalidatePath("/tenant/requests");
  revalidatePath("/owner/tickets");

  return { success: true, ticket };
}

export async function updateTicketStatusAction(id: string, statut: string) {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    statut,
    updated_at: new Date().toISOString(),
  };

  // Set timestamps based on status
  if (statut === "resolved") {
    updateData.resolved_at = new Date().toISOString();
  } else if (statut === "closed") {
    updateData.closed_at = new Date().toISOString();
  } else if (statut === "reopened") {
    updateData.resolved_at = null;
    updateData.resolution_notes = null;
  }

  const { error } = await supabase
    .from("tickets")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: "Erreur mise à jour statut" };

  revalidatePath("/owner/tickets");
  revalidatePath("/tenant/requests");
  revalidatePath(`/owner/tickets/${id}`);
  revalidatePath(`/tenant/requests/${id}`);

  return { success: true };
}

export async function addCommentAction(
  ticketId: string,
  content: string,
  isInternal?: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: "Profil introuvable" };

  const { error } = await supabase.from("ticket_comments").insert({
    ticket_id: ticketId,
    author_id: profile.id,
    content,
    is_internal: isInternal || false,
  });

  if (error) return { error: "Erreur ajout commentaire" };

  revalidatePath(`/owner/tickets/${ticketId}`);
  revalidatePath(`/tenant/requests/${ticketId}`);

  return { success: true };
}

export async function sendMessageAction(ticketId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: "Profil introuvable" };

  const { error } = await supabase.from("ticket_messages").insert({
    ticket_id: ticketId,
    sender_id: profile.id,
    content,
    read_at: null,
  });

  if (error) return { error: "Erreur envoi message" };

  revalidatePath(`/owner/tickets/${ticketId}`);
  revalidatePath(`/tenant/requests/${ticketId}`);

  return { success: true };
}
