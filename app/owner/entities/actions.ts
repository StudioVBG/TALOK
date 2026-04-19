"use server";

/**
 * Server Actions pour les entités juridiques
 *
 * CRUD complet avec validation Zod, RLS Supabase, et audit trail.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { z } from "zod";
import { canDeleteEntity } from "@/features/legal-entities/services/legal-entities.service";
import { isValidSiret, siretToSiren, isValidIban } from "@/lib/entities/siret-validation";
import { withFeatureAccess } from "@/lib/middleware/subscription-check";
import {
  computeFiscalYearDefaults,
  deriveDateCloture,
  validateFiscalYearRange,
} from "@/lib/entities/fiscal-year-defaults";

// ============================================
// SCHEMAS
// ============================================

const entityTypeSchema = z.enum([
  "particulier",
  "sci_ir",
  "sci_is",
  "sci_construction_vente",
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
        if (digits.length !== 14) return false;
        return isValidSiret(digits);
      },
      { message: "Le SIRET est invalide (14 chiffres, clé de Luhn incorrecte)" }
    ),
  capital_social: z.number().min(0).optional(),
  nombre_parts: z.number().int().min(1).optional(),
  rcs_ville: z.string().optional(),
  date_creation: z.string().optional(),
  numero_tva: z.string().optional(),
  adresse_siege: z.string().optional(),
  code_postal_siege: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{5}$/.test(val), {
      message: "Le code postal doit contenir 5 chiffres",
    }),
  ville_siege: z.string().optional(),
  pays_siege: z.string().default("France"),
  iban: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        return isValidIban(val);
      },
      { message: "L'IBAN est invalide (vérification MOD-97 échouée)" }
    ),
  bic: z.string().optional(),
  banque_nom: z.string().optional(),
  couleur: z.string().optional(),
  // Representative
  representant_mode: z.enum(["self", "other"]).default("self"),
  representant_prenom: z.string().optional(),
  representant_nom: z.string().optional(),
  representant_qualite: z.string().optional(),
  representant_date_naissance: z.string().optional(),
  // Contact info (stored in metadata JSONB)
  email_entite: z
    .string()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "Format d'email invalide",
    }),
  telephone_entite: z.string().optional(),
  // Exercice fiscal — optionnels côté API (dérivés si absents) mais
  // toujours persistés en base non-NULL par le serveur.
  premier_exercice_debut: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: "Date de début d'exercice invalide (format YYYY-MM-DD)",
    }),
  premier_exercice_fin: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: "Date de fin d'exercice invalide (format YYYY-MM-DD)",
    }),
  date_cloture_exercice: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{2}-\d{2}$/.test(val), {
      message: "Date de clôture invalide (format MM-DD)",
    }),
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

  // profile.id is the FK value for legal_entities.owner_profile_id
  // (owner_profiles PK is profile_id, not id)
  return { ownerProfileId: profile.id, profileId: profile.id };
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

    // Gate: hasMultiEntity — bypass pour "particulier" (entite par defaut)
    if (parsed.data.entity_type !== "particulier") {
      const featureCheck = await withFeatureAccess(auth.profileId, "multi_mandants");
      if (!featureCheck.allowed) {
        return { success: false, error: "La gestion multi-entites necessite un forfait Enterprise S ou superieur." };
      }
    }

    const supabase = await createClient();
    const data = parsed.data;

    const cleanSiret = data.siret?.replace(/\s/g, "") || null;

    // Check for SIRET duplicates (only if SIRET is provided)
    if (cleanSiret) {
      const { data: existing } = await supabase
        .from("legal_entities")
        .select("id, nom")
        .eq("siret", cleanSiret)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: `Ce SIRET est déjà utilisé par l'entité "${existing.nom}".`,
        };
      }
    }

    // Check for name+type duplicates when no SIRET (prevents unlimited "particulier" clones)
    if (!cleanSiret) {
      const { data: existingByName } = await supabase
        .from("legal_entities")
        .select("id, nom")
        .eq("owner_profile_id", auth.ownerProfileId)
        .eq("entity_type", data.entity_type)
        .eq("nom", data.nom)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (existingByName) {
        return {
          success: false,
          error: `Une entité "${existingByName.nom}" de ce type existe déjà.`,
        };
      }
    }

    // Auto-derive SIREN from SIRET
    const derivedSiren = cleanSiret ? siretToSiren(cleanSiret) : null;

    // Build metadata for fields without dedicated DB columns
    const metadata: Record<string, unknown> = {};
    if (data.email_entite) metadata.email = data.email_entite;
    if (data.telephone_entite) metadata.telephone = data.telephone_entite;

    // Compute fiscal year dates — never NULL. Takes user input if provided,
    // otherwise derives from regime + date_creation (calendar year for IR).
    const defaults = computeFiscalYearDefaults(
      data.regime_fiscal,
      data.date_creation
    );
    const premierExerciceDebut = data.premier_exercice_debut || defaults.premierExerciceDebut;
    const premierExerciceFin = data.premier_exercice_fin || defaults.premierExerciceFin;
    const dateClotureExercice =
      data.date_cloture_exercice || deriveDateCloture(premierExerciceFin);

    const rangeCheck = validateFiscalYearRange(premierExerciceDebut, premierExerciceFin);
    if (!rangeCheck.valid) {
      return { success: false, error: rangeCheck.error || "Exercice fiscal invalide" };
    }

    const { data: entity, error } = await supabase
      .from("legal_entities")
      .insert({
        owner_profile_id: auth.ownerProfileId,
        entity_type: data.entity_type,
        nom: data.nom,
        forme_juridique: data.forme_juridique || null,
        regime_fiscal: data.regime_fiscal || undefined,
        siret: cleanSiret,
        siren: derivedSiren,
        capital_social: data.capital_social || null,
        nombre_parts: data.nombre_parts || null,
        rcs_ville: data.rcs_ville || null,
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
        premier_exercice_debut: premierExerciceDebut,
        premier_exercice_fin: premierExerciceFin,
        date_cloture_exercice: dateClotureExercice,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createEntity] Error:", error);
      return { success: false, error: "Erreur lors de la création" };
    }

    // Create the opening accounting exercise so the compta module is usable
    // immediately. Idempotent: the DB trigger fn_legal_entities_bootstrap_exercise
    // may have already inserted the row — upsert with onConflict swallows
    // the duplicate cleanly.
    try {
      const serviceClient = getServiceClient();
      await serviceClient
        .from("accounting_exercises")
        .upsert(
          {
            entity_id: entity.id,
            start_date: premierExerciceDebut,
            end_date: premierExerciceFin,
            status: "open",
          },
          { onConflict: "entity_id,start_date,end_date", ignoreDuplicates: true }
        );
    } catch (exerciseError) {
      console.error("[createEntity] exercise creation failed:", exerciseError);
    }

    // Create representative as associate
    if (data.representant_mode === "self") {
      await supabase.from("entity_associates").insert({
        legal_entity_id: entity.id,
        profile_id: auth.profileId,
        nombre_parts: 100,
        pourcentage_capital: 100,
        is_gerant: true,
        is_current: true,
        date_entree: new Date().toISOString().split("T")[0],
      });
    } else if (data.representant_nom || data.representant_prenom) {
      await supabase.from("entity_associates").insert({
        legal_entity_id: entity.id,
        prenom: data.representant_prenom || "",
        nom: data.representant_nom || "",
        date_naissance: data.representant_date_naissance || null,
        nombre_parts: 100,
        pourcentage_capital: 100,
        is_gerant: true,
        is_current: true,
        date_entree: new Date().toISOString().split("T")[0],
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

    // Gate: hasMultiEntity — bypass pour "particulier"
    const { data: entityForGate } = await supabase
      .from("legal_entities")
      .select("entity_type")
      .eq("id", id)
      .single();
    if (entityForGate && entityForGate.entity_type !== "particulier") {
      const featureCheck = await withFeatureAccess(auth.profileId, "multi_mandants");
      if (!featureCheck.allowed) {
        return { success: false, error: "La gestion multi-entites necessite un forfait Enterprise S ou superieur." };
      }
    }

    // Guard: prevent entity_type change if active leases exist
    if (data.entity_type !== undefined) {
      const { data: current } = await supabase
        .from("legal_entities")
        .select("entity_type")
        .eq("id", id)
        .single();

      if (current && current.entity_type !== data.entity_type) {
        const { count: activeLeases } = await supabase
          .from("leases")
          .select("id", { count: "exact", head: true })
          .eq("signatory_entity_id", id)
          .in("statut", ["active", "pending_signature", "fully_signed"]);

        if (activeLeases && activeLeases > 0) {
          return {
            success: false,
            error: `Impossible de changer le type d'entité : ${activeLeases} bail(aux) actif(s). Clôturez les baux avant de modifier le type.`,
          };
        }
      }
    }

    const cleanSiret = data.siret !== undefined ? (data.siret?.replace(/\s/g, "") || null) : undefined;

    // Check for SIRET duplicates on update (exclude current entity)
    if (cleanSiret) {
      const { data: existing } = await supabase
        .from("legal_entities")
        .select("id, nom")
        .eq("siret", cleanSiret)
        .eq("is_active", true)
        .neq("id", id)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: `Ce SIRET est déjà utilisé par l'entité "${existing.nom}".`,
        };
      }
    }

    // Build update object, filtering out undefined values
    const updateData: Record<string, unknown> = {};
    if (data.nom !== undefined) updateData.nom = data.nom;
    if (data.entity_type !== undefined) updateData.entity_type = data.entity_type;
    if (data.forme_juridique !== undefined) updateData.forme_juridique = data.forme_juridique || null;
    if (data.regime_fiscal !== undefined) updateData.regime_fiscal = data.regime_fiscal || null;
    if (cleanSiret !== undefined) {
      updateData.siret = cleanSiret;
      updateData.siren = cleanSiret ? siretToSiren(cleanSiret) : null;
    }
    if (data.capital_social !== undefined) updateData.capital_social = data.capital_social || null;
    if (data.nombre_parts !== undefined) updateData.nombre_parts = data.nombre_parts || null;
    if (data.rcs_ville !== undefined) updateData.rcs_ville = data.rcs_ville || null;
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
    if (data.premier_exercice_debut !== undefined && data.premier_exercice_debut) {
      updateData.premier_exercice_debut = data.premier_exercice_debut;
    }
    if (data.premier_exercice_fin !== undefined && data.premier_exercice_fin) {
      updateData.premier_exercice_fin = data.premier_exercice_fin;
    }
    if (data.date_cloture_exercice !== undefined && data.date_cloture_exercice) {
      updateData.date_cloture_exercice = data.date_cloture_exercice;
    }

    // Handle metadata (email/telephone)
    if (data.email_entite !== undefined || data.telephone_entite !== undefined) {
      const { data: currentEntity } = await supabase
        .from("legal_entities")
        .select("metadata")
        .eq("id", id)
        .single();

      const existingMetadata = (currentEntity?.metadata as Record<string, unknown>) || {};
      const newMetadata = { ...existingMetadata };
      if (data.email_entite !== undefined) newMetadata.email = data.email_entite || undefined;
      if (data.telephone_entite !== undefined) newMetadata.telephone = data.telephone_entite || undefined;
      updateData.metadata = Object.keys(newMetadata).length > 0 ? newMetadata : null;
    }

    const { error } = await supabase
      .from("legal_entities")
      .update(updateData)
      .eq("id", id)
      .eq("owner_profile_id", auth.ownerProfileId);

    if (error) {
      console.error("[updateEntity] Error:", error);
      if (error.message?.includes("idx_legal_entities_siret_unique")) {
        return { success: false, error: "Ce SIRET est déjà utilisé par une autre entité." };
      }
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

    // Gate: hasMultiEntity — bypass pour "particulier"
    const { data: entityForGate } = await supabase
      .from("legal_entities")
      .select("entity_type")
      .eq("id", id)
      .single();
    if (entityForGate && entityForGate.entity_type !== "particulier") {
      const featureCheck = await withFeatureAccess(auth.profileId, "multi_mandants");
      if (!featureCheck.allowed) {
        return { success: false, error: "La gestion multi-entites necessite un forfait Enterprise S ou superieur." };
      }
    }

    const { canDelete, reason } = await canDeleteEntity(id);
    if (!canDelete) {
      return {
        success: false,
        error: reason ?? "Impossible de supprimer cette entité.",
      };
    }

    // Delete entity (CASCADE on FK handles associate cleanup automatically)
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

/**
 * Désactive une entité (soft delete) — alternative quand la suppression est bloquée
 */
export async function deactivateEntity(
  input: z.infer<typeof deleteEntitySchema> & { motif?: string }
): Promise<ActionResult> {
  try {
    const parsed = deleteEntitySchema.safeParse({ id: input.id });
    if (!parsed.success) {
      return { success: false, error: "ID invalide" };
    }

    const auth = await getAuthenticatedOwnerProfileId();
    if (!auth) {
      return { success: false, error: "Non autorisé" };
    }

    const supabase = await createClient();
    const { id } = parsed.data;

    const { error } = await supabase
      .from("legal_entities")
      .update({
        is_active: false,
        date_radiation: new Date().toISOString().split("T")[0],
        motif_radiation: input.motif || "Désactivation manuelle",
      })
      .eq("id", id)
      .eq("owner_profile_id", auth.ownerProfileId);

    if (error) {
      console.error("[deactivateEntity] Error:", error);
      return { success: false, error: "Erreur lors de la désactivation" };
    }

    revalidatePath("/owner/entities");
    revalidatePath(`/owner/entities/${id}`);
    revalidatePath("/owner/profile");

    return { success: true };
  } catch (error) {
    console.error("[deactivateEntity] Unexpected error:", error);
    return { success: false, error: "Erreur inattendue" };
  }
}

// ============================================
// ENSURE DEFAULT ENTITY
// ============================================

/**
 * Garantit qu'au moins une entité juridique "particulier" existe pour le propriétaire.
 * Crée l'entité si manquante, lie les propriétés orphelines, et retourne l'ID.
 * Utilise le service client (bypass RLS) pour éviter les problèmes de permissions.
 */
export async function ensureDefaultEntity(): Promise<ActionResult<{ id: string }>> {
  try {
    const auth = await getAuthenticatedOwnerProfileId();
    if (!auth) {
      return { success: false, error: "Non autorisé" };
    }

    const supabase = await createClient();

    // Vérifier si une entité existe déjà (via le client user, soumis à RLS)
    const { data: existing } = await supabase
      .from("legal_entities")
      .select("id")
      .eq("owner_profile_id", auth.ownerProfileId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { success: true, data: { id: existing.id } };
    }

    // Aucune entité trouvée — créer via service client (bypass RLS)
    const serviceClient = getServiceClient();

    // Récupérer le nom du profil
    const { data: profileData } = await serviceClient
      .from("profiles")
      .select("prenom, nom")
      .eq("id", auth.profileId)
      .single();

    const nom = profileData
      ? [profileData.prenom, profileData.nom].filter(Boolean).join(" ") || "Patrimoine personnel"
      : "Patrimoine personnel";

    // Garantir owner_profiles (upsert pour idempotence)
    const { error: opError } = await serviceClient
      .from("owner_profiles")
      .upsert(
        { profile_id: auth.ownerProfileId, type: "particulier" },
        { onConflict: "profile_id" }
      );

    if (opError) {
      console.error("[ensureDefaultEntity] owner_profiles upsert error:", opError.message);
    }

    // Compute calendar-year exercise for the default "particulier" entity
    const defaults = computeFiscalYearDefaults("ir", null);

    // Créer l'entité
    const { data: entity, error: leError } = await serviceClient
      .from("legal_entities")
      .insert({
        owner_profile_id: auth.ownerProfileId,
        entity_type: "particulier",
        nom,
        regime_fiscal: "ir",
        is_active: true,
        premier_exercice_debut: defaults.premierExerciceDebut,
        premier_exercice_fin: defaults.premierExerciceFin,
        date_cloture_exercice: defaults.dateClotureExercice,
      })
      .select("id")
      .single();

    if (leError || !entity) {
      // Handle unique constraint violation (race condition: another request just created it)
      if (leError?.code === "23505") {
        const { data: justCreated } = await serviceClient
          .from("legal_entities")
          .select("id")
          .eq("owner_profile_id", auth.ownerProfileId)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (justCreated) {
          return { success: true, data: { id: justCreated.id } };
        }
      }
      console.error("[ensureDefaultEntity] legal_entities insert error:", leError?.message);
      return { success: false, error: leError?.message || "Erreur de création" };
    }

    // Créer l'exercice comptable d'ouverture (idempotent — trigger DB peut
    // avoir déjà inséré la ligne)
    const { error: exerciseError } = await serviceClient
      .from("accounting_exercises")
      .upsert(
        {
          entity_id: entity.id,
          start_date: defaults.premierExerciceDebut,
          end_date: defaults.premierExerciceFin,
          status: "open",
        },
        { onConflict: "entity_id,start_date,end_date", ignoreDuplicates: true }
      );

    if (exerciseError) {
      console.error("[ensureDefaultEntity] exercise insert error:", exerciseError.message);
    }

    // Lier les propriétés orphelines à la nouvelle entité
    const { error: linkError } = await serviceClient
      .from("properties")
      .update({ legal_entity_id: entity.id })
      .eq("owner_id", auth.ownerProfileId)
      .is("legal_entity_id", null)
      .is("deleted_at", null);

    if (linkError) {
      console.error("[ensureDefaultEntity] link properties error:", linkError.message);
    }

    revalidatePath("/owner/entities");
    revalidatePath("/owner");

    return { success: true, data: { id: entity.id } };
  } catch (e) {
    console.error("[ensureDefaultEntity] Unexpected error:", e);
    return { success: false, error: "Erreur inattendue" };
  }
}

// ============================================
// BULK OPERATIONS
// ============================================

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * Supprime ou désactive en masse une liste d'entités.
 * Pour chaque ID : tente la suppression, sinon désactive.
 */
export async function bulkDeleteEntities(
  input: z.infer<typeof bulkDeleteSchema>
): Promise<
  ActionResult<{
    deleted: string[];
    deactivated: string[];
    failed: Array<{ id: string; reason: string }>;
  }>
> {
  try {
    const parsed = bulkDeleteSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "IDs invalides" };
    }

    const auth = await getAuthenticatedOwnerProfileId();
    if (!auth) {
      return { success: false, error: "Non autorisé" };
    }

    const supabase = await createClient();
    const deleted: string[] = [];
    const deactivated: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const id of parsed.data.ids) {
      try {
        // Verify ownership
        const { data: entity } = await supabase
          .from("legal_entities")
          .select("id, nom")
          .eq("id", id)
          .eq("owner_profile_id", auth.ownerProfileId)
          .eq("is_active", true)
          .maybeSingle();

        if (!entity) {
          failed.push({ id, reason: "Entité non trouvée ou déjà inactive" });
          continue;
        }

        const { canDelete } = await canDeleteEntity(id);

        if (canDelete) {
          const { error } = await supabase
            .from("legal_entities")
            .delete()
            .eq("id", id)
            .eq("owner_profile_id", auth.ownerProfileId);

          if (error) {
            failed.push({ id, reason: error.message });
          } else {
            deleted.push(id);
          }
        } else {
          // Fallback: deactivate
          const { error } = await supabase
            .from("legal_entities")
            .update({
              is_active: false,
              date_radiation: new Date().toISOString().split("T")[0],
              motif_radiation: "Suppression en masse — doublon",
            })
            .eq("id", id)
            .eq("owner_profile_id", auth.ownerProfileId);

          if (error) {
            failed.push({ id, reason: error.message });
          } else {
            deactivated.push(id);
          }
        }
      } catch {
        failed.push({ id, reason: "Erreur inattendue" });
      }
    }

    revalidatePath("/owner/entities");
    revalidatePath("/owner/profile");

    return { success: true, data: { deleted, deactivated, failed } };
  } catch (error) {
    console.error("[bulkDeleteEntities] Unexpected error:", error);
    return { success: false, error: "Erreur inattendue" };
  }
}

/**
 * Identifie les groupes de doublons pour le propriétaire connecté.
 * Retourne les groupes avec 2+ entités actives partageant (entity_type, nom).
 */
export async function findDuplicateEntities(): Promise<
  ActionResult<
    Array<{
      entityType: string;
      nom: string;
      count: number;
      ids: string[];
      keepId: string;
    }>
  >
> {
  try {
    const auth = await getAuthenticatedOwnerProfileId();
    if (!auth) {
      return { success: false, error: "Non autorisé" };
    }

    const supabase = await createClient();

    // Fetch all active entities for this owner
    const { data: entities, error } = await supabase
      .from("legal_entities")
      .select("id, entity_type, nom, created_at")
      .eq("owner_profile_id", auth.ownerProfileId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error || !entities) {
      return { success: false, error: "Erreur lors de la recherche" };
    }

    // Group by (entity_type, nom)
    const groups = new Map<
      string,
      Array<{ id: string; entity_type: string; nom: string; created_at: string }>
    >();

    for (const e of entities) {
      const key = `${e.entity_type}::${e.nom}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    // Filter to groups with duplicates
    const duplicates = Array.from(groups.values())
      .filter((g) => g.length > 1)
      .map((g) => ({
        entityType: g[0].entity_type,
        nom: g[0].nom,
        count: g.length,
        ids: g.map((e) => e.id),
        keepId: g[0].id, // oldest entity
      }));

    return { success: true, data: duplicates };
  } catch (error) {
    console.error("[findDuplicateEntities] Unexpected error:", error);
    return { success: false, error: "Erreur inattendue" };
  }
}

/**
 * Déduplique les entités : garde la plus ancienne de chaque groupe,
 * supprime/désactive les doublons.
 */
export async function deduplicateEntities(): Promise<
  ActionResult<{ totalRemoved: number; deleted: number; deactivated: number }>
> {
  try {
    const findResult = await findDuplicateEntities();
    if (!findResult.success) {
      return { success: false, error: findResult.error };
    }
    if (!findResult.data) {
      return { success: false, error: "Erreur recherche doublons" };
    }

    if (findResult.data.length === 0) {
      return { success: true, data: { totalRemoved: 0, deleted: 0, deactivated: 0 } };
    }

    // Collect all IDs to remove (everything except keepId)
    const idsToRemove: string[] = [];
    for (const group of findResult.data) {
      for (const id of group.ids) {
        if (id !== group.keepId) {
          idsToRemove.push(id);
        }
      }
    }

    const bulkResult = await bulkDeleteEntities({ ids: idsToRemove });
    if (!bulkResult.success) {
      return { success: false, error: bulkResult.error };
    }
    if (!bulkResult.data) {
      return { success: false, error: "Erreur suppression" };
    }

    const { deleted, deactivated } = bulkResult.data;
    return {
      success: true,
      data: {
        totalRemoved: deleted.length + deactivated.length,
        deleted: deleted.length,
        deactivated: deactivated.length,
      },
    };
  } catch (error) {
    console.error("[deduplicateEntities] Unexpected error:", error);
    return { success: false, error: "Erreur inattendue" };
  }
}
