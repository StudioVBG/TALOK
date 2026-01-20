import { createClient } from "@/lib/supabase/client";
import { tenantProfileSchema } from "@/lib/validations";
import type { TenantProfile } from "@/lib/types";

export interface CreateTenantProfileData {
  situation_pro?: string | null;
  revenus_mensuels?: number | null;
  nb_adultes: number;
  nb_enfants: number;
  garant_required: boolean;
}

export interface UpdateTenantProfileData extends Partial<CreateTenantProfileData> {}

export class TenantProfilesService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  async getTenantProfile(profileId: string) {
    const { data, error } = await this.supabase
      .from("tenant_profiles")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    return data as TenantProfile | null;
  }

  async createOrUpdateTenantProfile(profileId: string, data: CreateTenantProfileData) {
    const validatedData = tenantProfileSchema.parse(data);

    // Vérifier si le profil existe déjà
    const existing = await this.getTenantProfile(profileId);

    if (existing) {
      // Mettre à jour
      const { data: profile, error } = await this.supabase
        .from("tenant_profiles")
        .update(validatedData)
        .eq("profile_id", profileId)
        .select()
        .single();

      if (error) throw error;
      return profile as TenantProfile;
    } else {
      // Créer
      const { data: profile, error } = await this.supabase
        .from("tenant_profiles")
        .insert({
          profile_id: profileId,
          ...validatedData,
        })
        .select()
        .single();

      if (error) throw error;
      return profile as TenantProfile;
    }
  }
}

export const tenantProfilesService = new TenantProfilesService();

