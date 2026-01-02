"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// --- Schemas ---

const createTicketSchema = z.object({
  title: z.string().min(3, "Titre trop court"),
  description: z.string().min(10, "Description trop courte"),
  priority: z.enum(["basse", "normale", "haute", "urgente"]),
  property_id: z.string().uuid().optional(), // Optionnel si on passe par un bail
  lease_id: z.string().uuid().optional(),
});

const updateTicketSchema = z.object({
  id: z.string().uuid(),
  statut: z.enum(["open", "in_progress", "resolved", "closed", "cancelled"]),
});

const createMessageSchema = z.object({
  ticket_id: z.string().uuid(),
  content: z.string().min(1, "Message vide"),
  attachments: z.array(z.string()).optional(), // URLs des fichiers
});

// --- Actions ---

export async function createTicketAction(formData: z.infer<typeof createTicketSchema>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Non authentifié" };

  const validation = createTicketSchema.safeParse(formData);
  if (!validation.success) return { error: "Données invalides" };

  const { title, description, priority, property_id, lease_id } = validation.data;

  // Récupérer le profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: "Profil introuvable" };

  // Si lease_id est fourni, récupérer property_id automatiquement
  let finalPropertyId = property_id;
  if (!finalPropertyId && lease_id) {
    const { data: lease } = await supabase
      .from("leases")
      .select("property_id")
      .eq("id", lease_id)
      .single();
    if (lease) finalPropertyId = lease.property_id;
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      created_by_profile_id: profile.id,
      titre: title,
      description,
      priorite: priority,
      statut: "open",
      property_id: finalPropertyId,
      lease_id: lease_id
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
  const { error } = await supabase
    .from("tickets")
    .update({ statut, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "Erreur mise à jour statut" };

  revalidatePath("/owner/tickets");
  revalidatePath("/tenant/requests");
  revalidatePath(`/owner/tickets/${id}`);
  
  return { success: true };
}

export async function sendMessageAction(ticketId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      sender_id: profile.id,
      content,
      read_at: null 
    });

  if (error) return { error: "Erreur envoi message" };

  revalidatePath(`/owner/tickets/${ticketId}`);
  revalidatePath(`/tenant/requests/${ticketId}`);

  return { success: true };
}
