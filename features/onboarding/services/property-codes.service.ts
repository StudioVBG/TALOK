import { createClient } from "@/lib/supabase/client";

export interface PropertyCodeValidation {
  valid: boolean;
  property?: {
    id: string;
    adresse_complete: string;
    type: string;
    owner_id: string;
  };
  unit?: {
    id: string;
    nom: string;
    property_id: string;
  };
  error?: string;
}

export class PropertyCodesService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Valider un code de logement
   */
  async validatePropertyCode(code: string): Promise<PropertyCodeValidation> {
    // Chercher dans properties
    const { data: property, error: propertyError } = await this.supabase
      .from("properties")
      .select("id, adresse_complete, type, owner_id")
      .eq("unique_code", code.toUpperCase())
      .single();

    if (property && !propertyError) {
      return {
        valid: true,
        property: {
          id: property.id,
          adresse_complete: property.adresse_complete,
          type: property.type,
          owner_id: property.owner_id,
        },
      };
    }

    // Chercher dans units (si le code correspond à une unité)
    // Note: Les units n'ont pas de code unique dans le schéma actuel
    // On pourrait ajouter un champ code_logement_unique aux units si nécessaire

    return {
      valid: false,
      error: "Code de logement invalide",
    };
  }

  /**
   * Obtenir le code d'un logement
   */
  async getPropertyCode(propertyId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("properties")
      .select("unique_code")
      .eq("id", propertyId)
      .single();

    if (error || !data) return null;
    return data.unique_code;
  }

  /**
   * Obtenir le code d'une unité (colocation)
   */
  async getUnitCode(unitId: string): Promise<string | null> {
    // Si on ajoute un champ code_logement_unique aux units
    const { data, error } = await this.supabase
      .from("units")
      .select("property_id")
      .eq("id", unitId)
      .single();

    if (error || !data) return null;

    // Pour l'instant, on retourne le code de la propriété parente
    return this.getPropertyCode(data.property_id);
  }
}

export const propertyCodesService = new PropertyCodesService();

