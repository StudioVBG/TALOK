"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

// ============================================
// SCHÉMAS DE VALIDATION
// ============================================

const updatePropertySchema = z.object({
  id: z.string().uuid(),
  adresse_complete: z.string().min(1).optional(),
  code_postal: z.string().min(5).max(5).optional(),
  ville: z.string().min(1).optional(),
  surface: z.number().positive().optional(),
  nb_pieces: z.number().int().positive().optional(),
  loyer_base: z.number().nonnegative().optional(),
  charges_mensuelles: z.number().nonnegative().optional(),
  depot_garantie: z.number().nonnegative().optional(),
});

const deletePropertySchema = z.object({
  id: z.string().uuid(),
});

// ============================================
// TYPES DE RETOUR
// ============================================

type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Met à jour une propriété
 */
export async function updateProperty(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  // 1. Vérifier l'authentification
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Non authentifié" };
  }

  // 2. Récupérer le profil owner
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { success: false, error: "Accès non autorisé" };
  }

  // 3. Parser et valider les données
  const rawData = {
    id: formData.get("id") as string,
    adresse_complete: formData.get("adresse_complete") as string || undefined,
    code_postal: formData.get("code_postal") as string || undefined,
    ville: formData.get("ville") as string || undefined,
    surface: formData.get("surface") ? Number(formData.get("surface")) : undefined,
    nb_pieces: formData.get("nb_pieces") ? Number(formData.get("nb_pieces")) : undefined,
    loyer_base: formData.get("loyer_base") ? Number(formData.get("loyer_base")) : undefined,
    charges_mensuelles: formData.get("charges_mensuelles") ? Number(formData.get("charges_mensuelles")) : undefined,
    depot_garantie: formData.get("depot_garantie") ? Number(formData.get("depot_garantie")) : undefined,
  };

  const parsed = updatePropertySchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: "Données invalides: " + parsed.error.message };
  }

  const { id, ...updateData } = parsed.data;

  // 4. Vérifier que la propriété appartient au owner
  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", id)
    .single();

  if (!property || property.owner_id !== profile.id) {
    return { success: false, error: "Propriété non trouvée ou accès refusé" };
  }

  // 5. Mettre à jour
  const { error: updateError } = await supabase
    .from("properties")
    .update(updateData)
    .eq("id", id);

  if (updateError) {
    console.error("Update property error:", updateError);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }

  // 6. Revalider le cache
  revalidatePath("/app/owner/properties");
  revalidatePath(`/app/owner/properties/${id}`);

  return { success: true };
}

/**
 * Supprime une propriété
 */
export async function deleteProperty(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  // 1. Vérifier l'authentification
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Non authentifié" };
  }

  // 2. Récupérer le profil owner
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { success: false, error: "Accès non autorisé" };
  }

  // 3. Parser les données
  const parsed = deletePropertySchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { success: false, error: "ID invalide" };
  }

  const { id } = parsed.data;

  // 4. Vérifier que la propriété appartient au owner et qu'il n'y a pas de baux actifs
  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", id)
    .single();

  if (!property || property.owner_id !== profile.id) {
    return { success: false, error: "Propriété non trouvée ou accès refusé" };
  }

  // Vérifier les baux actifs
  const { data: activeLeases } = await supabase
    .from("leases")
    .select("id")
    .eq("property_id", id)
    .eq("statut", "active")
    .limit(1);

  if (activeLeases && activeLeases.length > 0) {
    return { success: false, error: "Impossible de supprimer : des baux actifs existent" };
  }

  // 5. Supprimer (soft delete si colonne available, sinon hard delete)
  const { error: deleteError } = await supabase
    .from("properties")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Delete property error:", deleteError);
    return { success: false, error: "Erreur lors de la suppression" };
  }

  // 6. Revalider et rediriger
  revalidatePath("/app/owner/properties");

  return { success: true };
}

/**
 * Change le statut d'une propriété
 */
export async function updatePropertyStatus(
  propertyId: string,
  newStatus: "draft" | "published" | "archived"
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

  // Vérifier ownership
  const { data: property } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", propertyId)
    .single();

  if (!property || property.owner_id !== profile.id) {
    return { success: false, error: "Propriété non trouvée" };
  }

  const { error } = await supabase
    .from("properties")
    .update({ etat: newStatus })
    .eq("id", propertyId);

  if (error) {
    return { success: false, error: "Erreur lors de la mise à jour du statut" };
  }

  revalidatePath("/app/owner/properties");
  revalidatePath(`/app/owner/properties/${propertyId}`);

  return { success: true };
}

