"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// ============================================
// TYPES
// ============================================

type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================
// SCHÉMAS
// ============================================

const terminateLeaseSchema = z.object({
  leaseId: z.string().uuid(),
  terminationDate: z.string().datetime().optional(),
  reason: z.string().optional(),
});

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Termine un bail
 */
export async function terminateLease(
  leaseId: string,
  terminationDate?: string,
  reason?: string
): Promise<ActionResult> {
  const supabase = await createClient();

  // 1. Vérifier l'authentification
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Non authentifié" };
  }

  // 2. Récupérer le profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { success: false, error: "Accès non autorisé" };
  }

  // 3. Vérifier que le bail appartient à ce propriétaire via la propriété
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id,
      statut,
      properties!inner(owner_id)
    `)
    .eq("id", leaseId)
    .single();

  if (!lease) {
    return { success: false, error: "Bail non trouvé" };
  }

  const propertyData = lease.properties as unknown as { owner_id: string };
  if (propertyData.owner_id !== profile.id) {
    return { success: false, error: "Accès refusé" };
  }

  if (lease.statut === "terminated") {
    return { success: false, error: "Ce bail est déjà terminé" };
  }

  // 4. Mettre à jour le bail
  const { error: updateError } = await supabase
    .from("leases")
    .update({
      statut: "terminated",
      date_fin: terminationDate || new Date().toISOString().split("T")[0],
      // motif_fin: reason, // Si la colonne existe
    })
    .eq("id", leaseId);

  if (updateError) {
    console.error("Terminate lease error:", updateError);
    return { success: false, error: "Erreur lors de la résiliation" };
  }

  // 5. Revalider
  revalidatePath("/owner/leases");
  revalidatePath(`/owner/leases/${leaseId}`);

  return { success: true };
}

/**
 * Active un bail (après signature)
 */
export async function activateLease(leaseId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Non authentifié" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { success: false, error: "Accès non autorisé" };
  }

  // Vérifier le bail
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id,
      statut,
      properties!inner(owner_id)
    `)
    .eq("id", leaseId)
    .single();

  if (!lease) {
    return { success: false, error: "Bail non trouvé" };
  }

  const propertyData = lease.properties as unknown as { owner_id: string };
  if (propertyData.owner_id !== profile.id) {
    return { success: false, error: "Accès refusé" };
  }

  if (lease.statut === "active") {
    return { success: false, error: "Ce bail est déjà actif" };
  }

  const { error } = await supabase
    .from("leases")
    .update({ statut: "active" })
    .eq("id", leaseId);

  if (error) {
    return { success: false, error: "Erreur lors de l'activation" };
  }

  revalidatePath("/owner/leases");
  revalidatePath(`/owner/leases/${leaseId}`);

  return { success: true };
}

/**
 * Met à jour le loyer d'un bail
 */
export async function updateLeaseRent(
  leaseId: string,
  newRent: number,
  newCharges?: number
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Non authentifié" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { success: false, error: "Accès non autorisé" };
  }

  // Validation
  if (newRent < 0) {
    return { success: false, error: "Le loyer doit être positif" };
  }

  // Vérifier ownership
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id,
      properties!inner(owner_id)
    `)
    .eq("id", leaseId)
    .single();

  if (!lease) {
    return { success: false, error: "Bail non trouvé" };
  }

  const propertyData = lease.properties as unknown as { owner_id: string };
  if (propertyData.owner_id !== profile.id) {
    return { success: false, error: "Accès refusé" };
  }

  const updateData: Record<string, number> = { loyer: newRent };
  if (newCharges !== undefined) {
    updateData.charges_forfaitaires = newCharges;
  }

  const { error } = await supabase
    .from("leases")
    .update(updateData)
    .eq("id", leaseId);

  if (error) {
    return { success: false, error: "Erreur lors de la mise à jour" };
  }

  revalidatePath("/owner/leases");
  revalidatePath(`/owner/leases/${leaseId}`);
  revalidatePath("/owner/money");

  return { success: true };
}

