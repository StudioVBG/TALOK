/**
 * Service de gestion de la première connexion
 *
 * Gère la détection de première connexion, l'affichage du modal de bienvenue,
 * et le déclenchement des notifications appropriées.
 */

import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

export interface FirstLoginState {
  isFirstLogin: boolean;
  loginCount: number;
  welcomeSeenAt: string | null;
  tourCompletedAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingSkippedAt: string | null;
}

export interface LoginResult {
  success: boolean;
  isFirstLogin: boolean;
  loginCount: number;
  error?: string;
}

export class FirstLoginService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Enregistre une connexion utilisateur et détecte si c'est la première
   */
  async recordLogin(profileId: string): Promise<LoginResult> {
    try {
      const { data, error } = await this.supabase
        .rpc('record_user_login', { p_profile_id: profileId });

      if (error) {
        console.error('Erreur enregistrement login:', error);
        return {
          success: false,
          isFirstLogin: false,
          loginCount: 0,
          error: error.message,
        };
      }

      return {
        success: data.success,
        isFirstLogin: data.is_first_login,
        loginCount: data.login_count,
      };
    } catch (err) {
      console.error('Erreur record login:', err);
      return {
        success: false,
        isFirstLogin: false,
        loginCount: 0,
        error: 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupère l'état de première connexion pour un profil
   */
  async getFirstLoginState(profileId: string): Promise<FirstLoginState | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        first_login_at,
        login_count,
        welcome_seen_at,
        tour_completed_at,
        onboarding_completed_at,
        onboarding_skipped_at
      `)
      .eq('id', profileId)
      .single();

    if (error || !data) {
      console.error('Erreur récupération état first login:', error);
      return null;
    }

    return {
      isFirstLogin: data.login_count === 1,
      loginCount: data.login_count || 0,
      welcomeSeenAt: data.welcome_seen_at,
      tourCompletedAt: data.tour_completed_at,
      onboardingCompletedAt: data.onboarding_completed_at,
      onboardingSkippedAt: data.onboarding_skipped_at,
    };
  }

  /**
   * Vérifie si c'est la première connexion
   */
  async isFirstLogin(profileId: string): Promise<boolean> {
    const state = await this.getFirstLoginState(profileId);
    return state?.isFirstLogin ?? false;
  }

  /**
   * Vérifie si le modal de bienvenue doit être affiché
   */
  async shouldShowWelcomeModal(profileId: string): Promise<boolean> {
    const state = await this.getFirstLoginState(profileId);
    if (!state) return false;

    // Afficher si:
    // 1. C'est la première ou deuxième connexion
    // 2. Le modal n'a pas encore été vu
    // 3. L'onboarding n'est pas encore complété ni skippé
    return (
      state.loginCount <= 2 &&
      !state.welcomeSeenAt &&
      !state.onboardingCompletedAt &&
      !state.onboardingSkippedAt
    );
  }

  /**
   * Vérifie si le tour guidé doit être affiché
   */
  async shouldShowTour(profileId: string): Promise<boolean> {
    const state = await this.getFirstLoginState(profileId);
    if (!state) return false;

    // Afficher le tour si:
    // 1. Le modal de bienvenue a été vu
    // 2. Le tour n'a pas encore été complété
    // 3. L'onboarding n'est pas skippé
    return (
      !!state.welcomeSeenAt &&
      !state.tourCompletedAt &&
      !state.onboardingSkippedAt
    );
  }

  /**
   * Marque le modal de bienvenue comme vu
   */
  async markWelcomeSeen(profileId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ welcome_seen_at: new Date().toISOString() })
      .eq('id', profileId);

    if (error) {
      console.error('Erreur marquage welcome seen:', error);
      return false;
    }
    return true;
  }

  /**
   * Marque le tour guidé comme complété
   */
  async markTourCompleted(profileId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ tour_completed_at: new Date().toISOString() })
      .eq('id', profileId);

    if (error) {
      console.error('Erreur marquage tour completed:', error);
      return false;
    }
    return true;
  }

  /**
   * Marque l'onboarding comme complété
   */
  async markOnboardingCompleted(profileId: string, role: UserRole): Promise<boolean> {
    const now = new Date().toISOString();

    // Mettre à jour le profil principal
    const { error: profileError } = await this.supabase
      .from('profiles')
      .update({ onboarding_completed_at: now })
      .eq('id', profileId);

    if (profileError) {
      console.error('Erreur marquage onboarding completed (profiles):', profileError);
      return false;
    }

    // Mettre à jour le profil spécifique au rôle
    const roleTable = `${role}_profiles`;
    const { error: roleError } = await this.supabase
      .from(roleTable)
      .update({
        onboarding_completed: true,
        onboarding_completed_at: now,
      })
      .eq('profile_id', profileId);

    if (roleError) {
      // Ignorer si la table n'existe pas pour ce rôle
      console.warn(`Note: Could not update ${roleTable}:`, roleError);
    }

    return true;
  }

  /**
   * Marque l'onboarding comme différé/skippé
   */
  async skipOnboarding(profileId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ onboarding_skipped_at: new Date().toISOString() })
      .eq('id', profileId);

    if (error) {
      console.error('Erreur skip onboarding:', error);
      return false;
    }
    return true;
  }

  /**
   * Annule le skip de l'onboarding (pour reprendre)
   */
  async resumeOnboarding(profileId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ onboarding_skipped_at: null })
      .eq('id', profileId);

    if (error) {
      console.error('Erreur resume onboarding:', error);
      return false;
    }
    return true;
  }

  /**
   * Enregistre une fonctionnalité comme découverte
   */
  async markFeatureDiscovered(profileId: string, featureKey: string): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return false;

    const { error } = await this.supabase
      .from('user_feature_discoveries')
      .upsert({
        user_id: user.id,
        profile_id: profileId,
        feature_key: featureKey,
        first_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,feature_key',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error('Erreur mark feature discovered:', error);
      return false;
    }
    return true;
  }

  /**
   * Marque un tooltip comme fermé
   */
  async dismissTooltip(profileId: string, featureKey: string): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return false;

    const { error } = await this.supabase
      .from('user_feature_discoveries')
      .upsert({
        user_id: user.id,
        profile_id: profileId,
        feature_key: featureKey,
        tooltip_dismissed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,feature_key',
      });

    if (error) {
      console.error('Erreur dismiss tooltip:', error);
      return false;
    }
    return true;
  }

  /**
   * Vérifie si un tooltip a été fermé
   */
  async isTooltipDismissed(featureKey: string): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return true; // Pas de user = pas de tooltip

    const { data, error } = await this.supabase
      .from('user_feature_discoveries')
      .select('tooltip_dismissed_at')
      .eq('user_id', user.id)
      .eq('feature_key', featureKey)
      .maybeSingle();

    if (error) return true; // En cas d'erreur, ne pas afficher
    return !!data?.tooltip_dismissed_at;
  }

  /**
   * Récupère toutes les fonctionnalités découvertes
   */
  async getDiscoveredFeatures(): Promise<string[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await this.supabase
      .from('user_feature_discoveries')
      .select('feature_key')
      .eq('user_id', user.id);

    if (error) return [];
    return data.map(d => d.feature_key);
  }
}

export const firstLoginService = new FirstLoginService();
