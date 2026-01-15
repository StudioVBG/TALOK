/**
 * Service d'analytics d'onboarding
 *
 * Track le parcours d'onboarding des utilisateurs pour identifier
 * les points de friction et optimiser le funnel.
 */

import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

export interface OnboardingStepData {
  step: string;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  skipped: boolean;
  attempts: number;
  errors?: string[];
}

export interface OnboardingAnalyticsData {
  id: string;
  userId: string;
  profileId: string;
  role: UserRole;
  startedAt: string;
  completedAt: string | null;
  totalDurationSeconds: number | null;
  stepsData: OnboardingStepData[];
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  droppedAtStep: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  deviceType: string | null;
  browser: string | null;
}

export class OnboardingAnalyticsService {
  private supabase = createClient();

  /**
   * Démarre le tracking d'onboarding pour un utilisateur
   */
  async startOnboarding(
    userId: string,
    profileId: string,
    role: UserRole,
    metadata?: {
      referrer?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    }
  ): Promise<string | null> {
    try {
      // Détecter le device type et browser
      const deviceType = this.detectDeviceType();
      const browser = this.detectBrowser();

      const { data, error } = await this.supabase
        .from("onboarding_analytics")
        .insert({
          user_id: userId,
          profile_id: profileId,
          role,
          started_at: new Date().toISOString(),
          steps_data: [],
          total_steps: 0,
          completed_steps: 0,
          skipped_steps: 0,
          referrer: metadata?.referrer,
          utm_source: metadata?.utmSource,
          utm_medium: metadata?.utmMedium,
          utm_campaign: metadata?.utmCampaign,
          device_type: deviceType,
          browser,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Erreur démarrage analytics:", error);
        return null;
      }

      return data.id;
    } catch (err) {
      console.error("Erreur start onboarding analytics:", err);
      return null;
    }
  }

  /**
   * Récupère ou crée une session d'analytics
   */
  async getOrCreateSession(
    userId: string,
    profileId: string,
    role: UserRole
  ): Promise<string | null> {
    // Chercher une session existante non complétée
    const { data: existing } = await this.supabase
      .from("onboarding_analytics")
      .select("id")
      .eq("user_id", userId)
      .eq("role", role)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // Créer une nouvelle session
    return this.startOnboarding(userId, profileId, role);
  }

  /**
   * Enregistre le début d'une étape
   */
  async startStep(analyticsId: string, step: string): Promise<boolean> {
    try {
      // Récupérer les données actuelles
      const { data: current } = await this.supabase
        .from("onboarding_analytics")
        .select("steps_data, total_steps")
        .eq("id", analyticsId)
        .single();

      if (!current) return false;

      const stepsData = current.steps_data as OnboardingStepData[];

      // Vérifier si l'étape existe déjà
      const existingIndex = stepsData.findIndex((s) => s.step === step);

      if (existingIndex >= 0) {
        // Incrémenter les tentatives
        stepsData[existingIndex].attempts += 1;
        stepsData[existingIndex].started_at = new Date().toISOString();
      } else {
        // Ajouter une nouvelle étape
        stepsData.push({
          step,
          started_at: new Date().toISOString(),
          skipped: false,
          attempts: 1,
        });
      }

      // Mettre à jour
      const { error } = await this.supabase
        .from("onboarding_analytics")
        .update({
          steps_data: stepsData,
          total_steps: stepsData.length,
        })
        .eq("id", analyticsId);

      return !error;
    } catch (err) {
      console.error("Erreur start step:", err);
      return false;
    }
  }

  /**
   * Enregistre la complétion d'une étape
   */
  async completeStep(analyticsId: string, step: string): Promise<boolean> {
    try {
      const { data: current } = await this.supabase
        .from("onboarding_analytics")
        .select("steps_data, completed_steps")
        .eq("id", analyticsId)
        .single();

      if (!current) return false;

      const stepsData = current.steps_data as OnboardingStepData[];
      const stepIndex = stepsData.findIndex((s) => s.step === step);

      if (stepIndex < 0) return false;

      const now = new Date();
      const startedAt = new Date(stepsData[stepIndex].started_at);
      const durationSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);

      stepsData[stepIndex] = {
        ...stepsData[stepIndex],
        completed_at: now.toISOString(),
        duration_seconds: durationSeconds,
        skipped: false,
      };

      // Compter les étapes complétées
      const completedCount = stepsData.filter((s) => s.completed_at && !s.skipped).length;

      const { error } = await this.supabase
        .from("onboarding_analytics")
        .update({
          steps_data: stepsData,
          completed_steps: completedCount,
        })
        .eq("id", analyticsId);

      return !error;
    } catch (err) {
      console.error("Erreur complete step:", err);
      return false;
    }
  }

  /**
   * Marque une étape comme skippée
   */
  async skipStep(analyticsId: string, step: string): Promise<boolean> {
    try {
      const { data: current } = await this.supabase
        .from("onboarding_analytics")
        .select("steps_data, skipped_steps")
        .eq("id", analyticsId)
        .single();

      if (!current) return false;

      const stepsData = current.steps_data as OnboardingStepData[];
      const stepIndex = stepsData.findIndex((s) => s.step === step);

      if (stepIndex >= 0) {
        stepsData[stepIndex].skipped = true;
      } else {
        stepsData.push({
          step,
          started_at: new Date().toISOString(),
          skipped: true,
          attempts: 0,
        });
      }

      const skippedCount = stepsData.filter((s) => s.skipped).length;

      const { error } = await this.supabase
        .from("onboarding_analytics")
        .update({
          steps_data: stepsData,
          skipped_steps: skippedCount,
          total_steps: stepsData.length,
        })
        .eq("id", analyticsId);

      return !error;
    } catch (err) {
      console.error("Erreur skip step:", err);
      return false;
    }
  }

  /**
   * Enregistre une erreur sur une étape
   */
  async recordStepError(analyticsId: string, step: string, error: string): Promise<boolean> {
    try {
      const { data: current } = await this.supabase
        .from("onboarding_analytics")
        .select("steps_data")
        .eq("id", analyticsId)
        .single();

      if (!current) return false;

      const stepsData = current.steps_data as OnboardingStepData[];
      const stepIndex = stepsData.findIndex((s) => s.step === step);

      if (stepIndex >= 0) {
        const errors = stepsData[stepIndex].errors || [];
        errors.push(`${new Date().toISOString()}: ${error}`);
        stepsData[stepIndex].errors = errors.slice(-10); // Garder les 10 dernières
      }

      const { error: updateError } = await this.supabase
        .from("onboarding_analytics")
        .update({ steps_data: stepsData })
        .eq("id", analyticsId);

      return !updateError;
    } catch (err) {
      console.error("Erreur record step error:", err);
      return false;
    }
  }

  /**
   * Marque l'onboarding comme complété
   */
  async completeOnboarding(analyticsId: string): Promise<boolean> {
    try {
      const { data: current } = await this.supabase
        .from("onboarding_analytics")
        .select("started_at")
        .eq("id", analyticsId)
        .single();

      if (!current) return false;

      const now = new Date();
      const startedAt = new Date(current.started_at);
      const totalDuration = Math.round((now.getTime() - startedAt.getTime()) / 1000);

      const { error } = await this.supabase
        .from("onboarding_analytics")
        .update({
          completed_at: now.toISOString(),
          total_duration_seconds: totalDuration,
          dropped_at_step: null,
        })
        .eq("id", analyticsId);

      return !error;
    } catch (err) {
      console.error("Erreur complete onboarding:", err);
      return false;
    }
  }

  /**
   * Marque l'onboarding comme abandonné
   */
  async markDropout(analyticsId: string, lastStep: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("onboarding_analytics")
        .update({
          dropped_at_step: lastStep,
        })
        .eq("id", analyticsId);

      return !error;
    } catch (err) {
      console.error("Erreur mark dropout:", err);
      return false;
    }
  }

  /**
   * Récupère les statistiques d'onboarding (admin)
   */
  async getStats(days: number = 30): Promise<any> {
    try {
      const { data, error } = await this.supabase.rpc("get_onboarding_stats", {
        p_days: days,
      });

      if (error) {
        console.error("Erreur get stats:", error);
        return null;
      }

      return data;
    } catch (err) {
      console.error("Erreur get onboarding stats:", err);
      return null;
    }
  }

  /**
   * Calcule le pourcentage de progression
   */
  calculateProgress(stepsData: OnboardingStepData[], totalStepsRequired: number): number {
    const completedCount = stepsData.filter((s) => s.completed_at && !s.skipped).length;
    return Math.round((completedCount / totalStepsRequired) * 100);
  }

  // Helpers privés

  private detectDeviceType(): string {
    if (typeof window === "undefined") return "unknown";

    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
    if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return "mobile";
    return "desktop";
  }

  private detectBrowser(): string {
    if (typeof window === "undefined") return "unknown";

    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("SamsungBrowser")) return "Samsung";
    if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
    if (ua.includes("Trident")) return "IE";
    if (ua.includes("Edge")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    return "unknown";
  }
}

export const onboardingAnalyticsService = new OnboardingAnalyticsService();
