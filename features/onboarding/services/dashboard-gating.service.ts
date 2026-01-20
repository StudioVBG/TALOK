import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  route?: string; // Route vers l'étape à compléter
}

export interface OnboardingChecklist {
  role: UserRole;
  items: ChecklistItem[];
  allCompleted: boolean;
}

export class DashboardGatingService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Vérifier si l'utilisateur peut accéder au dashboard
   */
  async canAccessDashboard(role: UserRole): Promise<boolean> {
    const checklist = await this.getChecklist(role);
    return checklist.allCompleted;
  }

  /**
   * Obtenir la checklist d'onboarding pour un rôle
   */
  async getChecklist(role: UserRole): Promise<OnboardingChecklist> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      return { role, items: [], allCompleted: false };
    }

    const items: ChecklistItem[] = [];

    switch (role) {
      case "owner":
        // Email vérifié
        const emailVerified = !!user.email_confirmed_at;
        items.push({
          id: "email_verified",
          label: "Email vérifié",
          completed: emailVerified,
        });

        // IBAN de versement
        const { data: ownerProfile, error: ownerError } = await this.supabase
          .from("owner_profiles")
          .select("iban")
          .eq("profile_id", (await this.getProfileId()) || "")
          .maybeSingle(); // Utiliser maybeSingle() pour éviter les erreurs 406 si le profil n'existe pas

        // Ignorer les erreurs si le profil n'existe pas encore
        if (ownerError && ownerError.code !== "PGRST116") {
          console.warn("Error fetching owner profile:", ownerError);
        }

        const ownerProfileData = ownerProfile as any;
        const hasIban = !!ownerProfileData?.iban;
        items.push({
          id: "iban_payout",
          label: "IBAN de versement configuré",
          completed: hasIban,
          route: "/owner/onboarding/finance",
        });

        // Au moins 1 logement
        const { count: propertiesCount } = await this.supabase
          .from("properties")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", (await this.getProfileId()) || "");

        const hasProperty = (propertiesCount || 0) > 0;
        items.push({
          id: "first_property",
          label: "Au moins un logement créé",
          completed: hasProperty,
          route: "/owner/onboarding/property",
        });

        break;

      case "tenant":
        // Email vérifié
        items.push({
          id: "email_verified",
          label: "Email vérifié",
          completed: !!user.email_confirmed_at,
        });

        // Rattaché à une tenancy (bail)
        const { count: leasesCount } = await this.supabase
          .from("lease_signers")
          .select("*", { count: "exact", head: true })
          .eq("profile_id", (await this.getProfileId()) || "");

        const hasLease = (leasesCount || 0) > 0;
        items.push({
          id: "attached_to_lease",
          label: "Rattaché à un bail",
          completed: hasLease,
          route: "/tenant/onboarding/context",
        });

        break;

      case "provider":
        // Email vérifié
        items.push({
          id: "email_verified",
          label: "Email vérifié",
          completed: !!user.email_confirmed_at,
        });

        // Profil complété
        const { data: providerProfile, error: providerError } = await this.supabase
          .from("provider_profiles")
          .select("type_services")
          .eq("profile_id", (await this.getProfileId()) || "")
          .maybeSingle(); // Utiliser maybeSingle() pour éviter les erreurs 406 si le profil n'existe pas

        // Ignorer les erreurs si le profil n'existe pas encore
        if (providerError && providerError.code !== "PGRST116") {
          console.warn("Error fetching provider profile:", providerError);
        }

        const providerProfileData = providerProfile as any;
        const profileComplete = !!providerProfileData && (providerProfileData.type_services?.length || 0) > 0;
        items.push({
          id: "profile_complete",
          label: "Profil complété",
          completed: profileComplete,
          route: "/provider/onboarding/profile",
        });

        break;
    }

    const allCompleted = items.every((item) => item.completed);

    return {
      role,
      items,
      allCompleted,
    };
  }

  /**
   * Obtenir l'ID du profil de l'utilisateur
   */
  private async getProfileId(): Promise<string | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as any;
    return profileData?.id || null;
  }
}

export const dashboardGatingService = new DashboardGatingService();

