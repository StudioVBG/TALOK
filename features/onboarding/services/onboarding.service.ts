import { createClient } from "@/lib/supabase/client";
import { authService } from "@/features/auth/services/auth.service";
import type { UserRole } from "@/lib/types";

export interface OnboardingProgress {
  step: string;
  completed: boolean;
  data?: Record<string, unknown>;
}

export interface OnboardingDraft {
  id: string;
  user_id: string;
  role: UserRole;
  step: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class OnboardingService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Sauvegarder un brouillon d'onboarding
   */
  async saveDraft(step: string, data: Record<string, unknown>, role?: UserRole): Promise<void> {
    // Sauvegarder dans localStorage d'abord (fonctionne même sans authentification)
    if (typeof window !== "undefined") {
      const draft = {
        step,
        data,
        role,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem("onboarding_draft", JSON.stringify(draft));
    }

    // Essayer de sauvegarder dans la BDD seulement si l'utilisateur est authentifié
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    if (user) {
      // Sauvegarder dans la BDD
      const { error } = await this.supabase.from("onboarding_drafts").upsert(
        {
          user_id: user.id,
          role: role || null,
          step,
          data,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

      if (error) {
        console.error("Erreur sauvegarde brouillon:", error);
        // Ne pas bloquer si la sauvegarde échoue
      }
    }
    // Si pas d'utilisateur, on continue quand même (données dans localStorage)
  }

  /**
   * Récupérer un brouillon d'onboarding
   */
  async getDraft(): Promise<OnboardingDraft | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return null;

    // Essayer localStorage d'abord
    if (typeof window !== "undefined") {
      const localDraft = localStorage.getItem("onboarding_draft");
      if (localDraft) {
        try {
          return JSON.parse(localDraft);
        } catch {
          // Ignorer les erreurs de parsing
        }
      }
    }

    // Récupérer depuis la BDD
    const { data, error } = await this.supabase
      .from("onboarding_drafts")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Supprimer un brouillon
   */
  async clearDraft(): Promise<void> {
    if (typeof window !== "undefined") {
      localStorage.removeItem("onboarding_draft");
    }

    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return;

    await this.supabase.from("onboarding_drafts").delete().eq("user_id", user.id);
  }

  /**
   * Marquer une étape comme complétée
   */
  async markStepCompleted(step: string, role: UserRole): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    
    // Si l'utilisateur n'est pas authentifié, on ne peut pas marquer l'étape comme complétée
    // mais on ne lance pas d'erreur (l'étape sera marquée plus tard après authentification)
    if (!user) {
      console.warn("Impossible de marquer l'étape comme complétée : utilisateur non authentifié");
      return;
    }

    const { error } = await this.supabase.from("onboarding_progress").upsert(
      {
        user_id: user.id,
        role,
        step,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,role,step",
      }
    );

    if (error) throw error;
  }

  /**
   * Vérifier si une étape est complétée
   */
  async isStepCompleted(step: string, role: UserRole): Promise<boolean> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await this.supabase
      .from("onboarding_progress")
      .select("completed")
      .eq("user_id", user.id)
      .eq("role", role)
      .eq("step", step)
      .single();

    if (error || !data) return false;
    return data.completed;
  }

  /**
   * Obtenir le progrès d'onboarding pour un rôle
   */
  async getOnboardingProgress(role: UserRole): Promise<OnboardingProgress[]> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await this.supabase
      .from("onboarding_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("role", role)
      .order("completed_at", { ascending: true });

    if (error || !data) return [];
    return data;
  }

  /**
   * Vérifier si l'onboarding est complet pour un rôle
   */
  async isOnboardingComplete(role: UserRole): Promise<boolean> {
    const requiredSteps = this.getRequiredSteps(role);
    const progress = await this.getOnboardingProgress(role);

    const completedSteps = progress.filter((p) => p.completed).map((p) => p.step);
    return requiredSteps.every((step) => completedSteps.includes(step));
  }

  /**
   * Obtenir les étapes requises pour un rôle
   * Note: Les consentements et le profil minimal sont maintenant intégrés dans account_creation
   */
  private getRequiredSteps(role: UserRole): string[] {
    switch (role) {
      case "owner":
        return [
          "role_choice",
          "account_creation",  // Inclut: identité, consentements, téléphone
          "email_verification",
          "owner_profile",
          "owner_finance",
          "first_property",
          "final_review",
        ];
      case "tenant":
        return [
          "role_choice",
          "account_creation",
          "email_verification",
          "tenant_context",
          "tenant_file",
          "tenant_identity",  // Vérification d'identité KYC
          "tenant_payment",
        ];
      case "provider":
        return [
          "role_choice",
          "account_creation",
          "email_verification",
          "provider_profile",
          "provider_services",
          "provider_ops",
        ];
      case "guarantor":
        return [
          "role_choice",
          "account_creation",
          "email_verification",
          "guarantor_context",
          "guarantor_financial",
          "guarantor_sign",
        ];
      default:
        return [];
    }
  }
}

export const onboardingService = new OnboardingService();

