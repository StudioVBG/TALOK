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
  private supabase = createClient();

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
        .update(validatedData as any)
        .eq("profile_id", profileId)
        .select()
        .single();

      if (error) throw error;
      return profile as unknown as ProviderProfile;
    } else {
      // Créer
      const { data: profile, error } = await this.supabase
        .from("provider_profiles")
        .insert({
          profile_id: profileId,
          ...validatedData,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return profile as unknown as ProviderProfile;
    }
  }
}

export const providerProfilesService = new ProviderProfilesService();

