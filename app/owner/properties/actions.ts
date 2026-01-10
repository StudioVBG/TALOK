"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

// ============================================
// SCHÉMAS DE VALIDATION - SOTA 2026
// ============================================

/**
 * SOTA 2026: Schéma V3 complet pour la mise à jour de propriétés
 * Supporte tous les champs du nouveau wizard immersif
 */
const updatePropertySchemaV3 = z.object({
  id: z.string().uuid(),

  // === Adresse ===
  adresse_complete: z.string().min(1).optional(),
  complement_adresse: z.string().optional().nullable(),
  code_postal: z.string().regex(/^[0-9]{5}$/, "Code postal invalide (5 chiffres)").optional(),
  ville: z.string().min(1).optional(),
  departement: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),

  // === Surfaces ===
  surface: z.number().positive("Surface doit être positive").optional(),
  surface_habitable_m2: z.number().positive("Surface habitable doit être positive").optional(),
  surface_terrain: z.number().nonnegative().optional().nullable(),

  // === Configuration logement ===
  nb_pieces: z.number().int().min(0).optional(),
  nb_chambres: z.number().int().min(0).optional(),
  etage: z.number().int().min(0).optional().nullable(),
  ascenseur: z.boolean().optional().nullable(),
  meuble: z.boolean().optional().nullable(),

  // === Financier ===
  loyer_base: z.number().nonnegative().optional(),
  loyer_hc: z.number().nonnegative("Loyer HC doit être positif ou nul").optional(),
  charges_mensuelles: z.number().nonnegative().optional(),
  depot_garantie: z.number().nonnegative().optional(),

  // === DPE / Énergie ===
  dpe_classe_energie: z.enum(["A", "B", "C", "D", "E", "F", "G", "NC"]).optional().nullable(),
  dpe_classe_climat: z.enum(["A", "B", "C", "D", "E", "F", "G", "NC"]).optional().nullable(),
  dpe_consommation: z.number().nonnegative().optional().nullable(),
  dpe_emissions: z.number().nonnegative().optional().nullable(),

  // === Chauffage ===
  chauffage_type: z.enum(["individuel", "collectif", "aucun"]).optional().nullable(),
  chauffage_energie: z.enum(["electricite", "gaz", "fioul", "bois", "reseau_urbain", "autre"]).optional().nullable(),
  eau_chaude_type: z.enum(["electrique_indiv", "gaz_indiv", "collectif", "solaire", "autre"]).optional().nullable(),

  // === Climatisation ===
  clim_presence: z.enum(["aucune", "fixe", "mobile"]).optional().nullable(),
  clim_type: z.enum(["split", "gainable"]).optional().nullable(),

  // === Équipements (tableau V3) ===
  equipments: z.array(z.string()).optional(),

  // === Parking (V3) ===
  parking_type: z.string().optional().nullable(),
  parking_acces: z.array(z.string()).optional().nullable(),

  // === Caractéristiques additionnelles ===
  has_balcon: z.boolean().optional().nullable(),
  has_terrasse: z.boolean().optional().nullable(),
  has_jardin: z.boolean().optional().nullable(),
  has_cave: z.boolean().optional().nullable(),

  // === Publication ===
  visibility: z.enum(["public", "private"]).optional(),
  available_from: z.string().optional().nullable(),
  etat: z.enum(["draft", "published", "archived"]).optional(),

  // === Médias ===
  visite_virtuelle_url: z.string().url().optional().nullable().or(z.literal("")),
  description: z.string().optional().nullable(),
}).passthrough(); // SOTA 2026: Permet les champs additionnels pour compatibilité future

// Alias pour compatibilité
const updatePropertySchema = updatePropertySchemaV3;

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

  // 3. SOTA 2026: Parser et valider les données V3
  // Helper pour parser les nombres de façon sécurisée
  const parseNumber = (value: FormDataEntryValue | null): number | undefined => {
    if (value === null || value === "") return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  };

  // Helper pour parser les booléens
  const parseBoolean = (value: FormDataEntryValue | null): boolean | undefined => {
    if (value === null || value === "") return undefined;
    return value === "true" || value === "1";
  };

  // Helper pour parser les tableaux JSON
  const parseArray = (value: FormDataEntryValue | null): string[] | undefined => {
    if (value === null || value === "") return undefined;
    try {
      const parsed = JSON.parse(value as string);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  };

  const rawData: Record<string, any> = {
    id: formData.get("id") as string,

    // Adresse
    adresse_complete: formData.get("adresse_complete") as string || undefined,
    complement_adresse: formData.get("complement_adresse") as string || undefined,
    code_postal: formData.get("code_postal") as string || undefined,
    ville: formData.get("ville") as string || undefined,
    departement: formData.get("departement") as string || undefined,
    latitude: parseNumber(formData.get("latitude")),
    longitude: parseNumber(formData.get("longitude")),

    // Surfaces
    surface: parseNumber(formData.get("surface")),
    surface_habitable_m2: parseNumber(formData.get("surface_habitable_m2")),
    surface_terrain: parseNumber(formData.get("surface_terrain")),

    // Configuration
    nb_pieces: parseNumber(formData.get("nb_pieces")),
    nb_chambres: parseNumber(formData.get("nb_chambres")),
    etage: parseNumber(formData.get("etage")),
    ascenseur: parseBoolean(formData.get("ascenseur")),
    meuble: parseBoolean(formData.get("meuble")),

    // Financier
    loyer_base: parseNumber(formData.get("loyer_base")),
    loyer_hc: parseNumber(formData.get("loyer_hc")),
    charges_mensuelles: parseNumber(formData.get("charges_mensuelles")),
    depot_garantie: parseNumber(formData.get("depot_garantie")),

    // DPE
    dpe_classe_energie: formData.get("dpe_classe_energie") as string || undefined,
    dpe_classe_climat: formData.get("dpe_classe_climat") as string || undefined,
    dpe_consommation: parseNumber(formData.get("dpe_consommation")),
    dpe_emissions: parseNumber(formData.get("dpe_emissions")),

    // Chauffage
    chauffage_type: formData.get("chauffage_type") as string || undefined,
    chauffage_energie: formData.get("chauffage_energie") as string || undefined,
    eau_chaude_type: formData.get("eau_chaude_type") as string || undefined,

    // Climatisation
    clim_presence: formData.get("clim_presence") as string || undefined,
    clim_type: formData.get("clim_type") as string || undefined,

    // Équipements
    equipments: parseArray(formData.get("equipments")),

    // Parking
    parking_type: formData.get("parking_type") as string || undefined,
    parking_acces: parseArray(formData.get("parking_acces")),

    // Caractéristiques
    has_balcon: parseBoolean(formData.get("has_balcon")),
    has_terrasse: parseBoolean(formData.get("has_terrasse")),
    has_jardin: parseBoolean(formData.get("has_jardin")),
    has_cave: parseBoolean(formData.get("has_cave")),

    // Publication
    visibility: formData.get("visibility") as string || undefined,
    available_from: formData.get("available_from") as string || undefined,
    etat: formData.get("etat") as string || undefined,

    // Médias
    visite_virtuelle_url: formData.get("visite_virtuelle_url") as string || undefined,
    description: formData.get("description") as string || undefined,
  };

  // SOTA 2026: Nettoyer les undefined avant validation
  const cleanedData = Object.fromEntries(
    Object.entries(rawData).filter(([_, v]) => v !== undefined)
  );

  const parsed = updatePropertySchema.safeParse(cleanedData);
  if (!parsed.success) {
    console.error("[updateProperty] Validation error:", parsed.error.flatten());
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errorMessages = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${errors?.join(", ")}`)
      .join("; ");
    return { success: false, error: "Données invalides: " + errorMessages };
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
  revalidatePath("/owner/properties");
  revalidatePath(`/owner/properties/${id}`);

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
  revalidatePath("/owner/properties");

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

  revalidatePath("/owner/properties");
  revalidatePath(`/owner/properties/${propertyId}`);

  return { success: true };
}

