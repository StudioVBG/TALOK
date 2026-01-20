import { createClient } from "@/lib/supabase/client";
import { providerProfileSchema } from "@/lib/validations";
import type { ProviderProfile } from "@/lib/types";

export interface CreateProviderProfileData {
  type_services: string[];
  certifications?: string | null;
  zones_intervention?: string | null;
}

export interface UpdateProviderProfileData extends Partial<CreateProviderProfileData> {}

export class ProviderProfilesService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  async getProviderProfile(profileId: string) {
    const { data, error } = await this.supabase
      .from("provider_profiles")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    return data as ProviderProfile | null;
  }

  async createOrUpdateProviderProfile(profileId: string, data: CreateProviderProfileData) {
    const validatedData = providerProfileSchema.parse(data);

    // Vérifier si le profil existe déjà
    const existing = await this.getProviderProfile(profileId);

    if (existing) {
      // Mettre à jour
      const { data: profile, error } = await this.supabase
        .from("provider_profiles")
        .update(validatedData)
        .eq("profile_id", profileId)
        .select()
        .single();

      if (error) throw error;
      return profile as ProviderProfile;
    } else {
      // Créer
      const { data: profile, error } = await this.supabase
        .from("provider_profiles")
        .insert({
          profile_id: profileId,
          ...validatedData,
        })
        .select()
        .single();

      if (error) throw error;
      return profile as ProviderProfile;
    }
  }
}

export const providerProfilesService = new ProviderProfilesService();

