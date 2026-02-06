"use server";

/**
 * Server Actions pour les entités juridiques
 *
 * CRUD complet avec validation Zod, RLS Supabase, et audit trail.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// ============================================
// SCHEMAS
// ============================================

const entityTypeSchema = z.enum([
  "particulier",
  "sci_ir",
  "sci_is",
  "sarl",
  "sarl_famille",
  "eurl",
  "sas",
  "sasu",
  "sa",
  "snc",
  "indivision",
  "demembrement_usufruit",
  "demembrement_nue_propriete",
  "holding",
]);

const createEntitySchema = z.object({
  entity_type: entityTypeSchema,
  nom: z.string().min(1, "Le nom est obligatoire").max(200),
  forme_juridique: z.string().optional(),
  regime_fiscal: z.enum(["ir", "is", "ir_option_is", "is_option_ir"]).optional(),
  siret: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const digits = val.replace(/\D/g, "");
        return digits.length === 14;
      },
      { message: "Le SIRET doit contenir 14 chiffres" }
    ),
  capital_social: z.number().min(0).optional(),
  date_creation: z.string().optional(),
  numero_tva: z.string().optional(),
  adresse_siege: z.string().optional(),
  code_postal_siege: z.string().optional(),
  ville_siege: z.string().optional(),
  pays_siege: z.string().default("France"),
  iban: z.string().optional(),
  bic: z.string().optional(),
  banque_nom: z.string().optional(),
  couleur: z.string().optional(),
  representant_prenom: z.string().optional(),
  representant_nom: z.string().optional(),
  representant_qualite: z.string().optional(),
});

const updateEntitySchema = createEntitySchema.partial().extend({
  id: z.string().uuid(),
});

const deleteEntitySchema = z.object({
  id: z.string().uuid(),
});

// ============================================
// TYPES
// ============================================

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================
// HELPERS
// ============================================

async function getAuthenticatedOwnerProfileId(): Promise<{
  ownerProfileId: string;
  profileId: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") return null;

  const { data: ownerProfile } = await supabase
    .from("owner_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!ownerProfile) return null;

  return { ownerProfileId: ownerProfile.id, profileId: profile.id };
}

// ============================================
// ACTIONS
// ============================================

export async function createEntity(
  input: z.infer<typeof createEntitySchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createEntitySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const auth = await getAuthenticatedOwnerProfileId();
    if (!auth) {
      return { success: false, error: "Non autorisé" };
    }

    const supabase = await createClient();
    const data = parsed.data;

    const { data: entity, error } = await supabase
      .from("legal_entities")
      .insert({
        owner_profile_id: auth.ownerProfileId,
        entity_type: data.entity_type,
        nom: data.nom,
        forme_juridique: data.forme_juridique || null,
        regime_fiscal: data.regime_fiscal || null,
        siret: data.siret?.replace(/\s/g, "") || null,
        capital_social: data.capital_social || null,
        date_creation: data.date_creation || null,
        numero_tva: data.numero_tva || null,
        adresse_siege: data.adresse_siege || null,
        code_postal_siege: data.code_postal_siege || null,
        ville_siege: data.ville_siege || null,
        pays_siege: data.pays_siege || "France",
        iban: data.iban?.replace(/\s/g, "") || null,
        bic: data.bic || null,
        banque_nom: data.banque_nom || null,
        couleur: data.couleur || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createEntity] Error:", error);
      return { success: false, error: "Erreur lors de la création" };
    }

    // Create representative as associate if provided
    if (data.representant_prenom || data.representant_nom) {
      await supabase.from("entity_associates").insert({
        legal_entity_id: entity.id,
        prenom: data.representant_prenom || "",
        nom: data.representant_nom || "",
        qualite: data.representant_qualite || "Gérant",
        is_gerant: true,
        is_current: true,
      });
    }

    revalidatePath("/owner/entities");
    revalidatePath("/owner/profile");

    return { success: true, data: { id: entity.id } };
  } catch (error) {
    console.error("[createEntity] Unexpected error:", error);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function updateEntity(
  input: z.infer<typeof updateEntitySchema>
): Promise<ActionResult> {
  try {
    const parsed = updateEntitySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const auth = await getAuthenticatedOwnerProfileId();
    if (!auth) {
      return { success: false, error: "Non autorisé" };
    }

    const supabase = await createClient();
    const { id, ...data } = parsed.data;

    // Build update object, filtering out undefined values
    const updateData: Record<string, unknown> = {};
    if (data.nom !== undefined) updateData.nom = data.nom;
    if (data.entity_type !== undefined) updateData.entity_type = data.entity_type;
    if (data.forme_juridique !== undefined) updateData.forme_juridique = data.forme_juridique || null;
    if (data.regime_fiscal !== undefined) updateData.regime_fiscal = data.regime_fiscal || null;
    if (data.siret !== undefined) updateData.siret = data.siret?.replace(/\s/g, "") || null;
    if (data.capital_social !== undefined) updateData.capital_social = data.capital_social || null;
    if (data.date_creation !== undefined) updateData.date_creation = data.date_creation || null;
    if (data.numero_tva !== undefined) updateData.numero_tva = data.numero_tva || null;
    if (data.adresse_siege !== undefined) updateData.adresse_siege = data.adresse_siege || null;
    if (data.code_postal_siege !== undefined) updateData.code_postal_siege = data.code_postal_siege || null;
    if (data.ville_siege !== undefined) updateData.ville_siege = data.ville_siege || null;
    if (data.pays_siege !== undefined) updateData.pays_siege = data.pays_siege || "France";
    if (data.iban !== undefined) updateData.iban = data.iban?.replace(/\s/g, "") || null;
    if (data.bic !== undefined) updateData.bic = data.bic || null;
    if (data.banque_nom !== undefined) updateData.banque_nom = data.banque_nom || null;
    if (data.couleur !== undefined) updateData.couleur = data.couleur || null;

    const { error } = await supabase
      .from("legal_entities")
      .update(updateData)
      .eq("id", id)
      .eq("owner_profile_id", auth.ownerProfileId);

    if (error) {
      console.error("[updateEntity] Error:", error);
      return { success: false, error: "Erreur lors de la mise à jour" };
    }

    revalidatePath("/owner/entities");
    revalidatePath(`/owner/entities/${id}`);

    return { success: true };
  } catch (error) {
    console.error("[updateEntity] Unexpected error:", error);
    return { success: false, error: "Erreur inattendue" };
  }
}

export async function deleteEntity(
  input: z.infer<typeof deleteEntitySchema>
): Promise<ActionResult> {
  try {
    const parsed = deleteEntitySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "ID invalide" };
    }

    const auth = await getAuthenticatedOwnerProfileId();
    if (!auth) {
      return { success: false, error: "Non autorisé" };
    }

    const supabase = await createClient();
    const { id } = parsed.data;

    // Check if entity has active properties or leases
    const { data: ownerships } = await supabase
      .from("property_ownerships")
      .select("id")
      .eq("legal_entity_id", id)
      .eq("is_current", true)
      .limit(1);

    if (ownerships && ownerships.length > 0) {
      return {
        success: false,
        error:
          "Impossible de supprimer cette entité : elle possède encore des biens. Transférez-les d'abord.",
      };
    }

    // Delete associates first (cascade would handle this but being explicit)
    await supabase
      .from("entity_associates")
      .delete()
      .eq("legal_entity_id", id);

    // Delete entity
    const { error } = await supabase
      .from("legal_entities")
      .delete()
      .eq("id", id)
      .eq("owner_profile_id", auth.ownerProfileId);

    if (error) {
      console.error("[deleteEntity] Error:", error);
      return { success: false, error: "Erreur lors de la suppression" };
    }

    revalidatePath("/owner/entities");
    revalidatePath("/owner/profile");

    return { success: true };
  } catch (error) {
    console.error("[deleteEntity] Unexpected error:", error);
    return { success: false, error: "Erreur inattendue" };
  }
}
