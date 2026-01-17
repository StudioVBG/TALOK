"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { firstLoginService, type FirstLoginState } from "../services/first-login.service";
import { onboardingService } from "../services/onboarding.service";
import { onboardingNotificationsService } from "../services/onboarding-notifications.service";
import { onboardingAnalyticsService } from "../services/onboarding-analytics.service";
import type { UserRole } from "@/lib/types";

// Types
export interface OnboardingState {
  isLoading: boolean;
  isFirstLogin: boolean;
  showWelcomeModal: boolean;
  showTour: boolean;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  progressPercent: number;
  analyticsId: string | null;
  error: string | null;
}

export interface OnboardingActions {
  recordLogin: () => Promise<void>;
  markWelcomeSeen: () => Promise<void>;
  startTour: () => void;
  completeTour: () => Promise<void>;
  closeTour: () => void;
  startStep: (step: string) => Promise<void>;
  completeStep: (step: string) => Promise<void>;
  skipStep: (step: string) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resumeOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  dismissTooltip: (featureKey: string) => Promise<void>;
}

// Configuration des étapes par rôle
const STEPS_CONFIG: Record<UserRole, { id: string; label: string }[]> = {
  owner: [
    { id: "owner_profile", label: "Profil" },
    { id: "owner_finance", label: "Finances" },
    { id: "first_property", label: "Bien" },
    { id: "automation", label: "Automatisation" },
    { id: "invite", label: "Invitations" },
    { id: "final_review", label: "Validation" },
  ],
  tenant: [
    { id: "tenant_context", label: "Contexte" },
    { id: "tenant_file", label: "Dossier" },
    { id: "tenant_identity", label: "Identité" },
    { id: "tenant_payment", label: "Paiement" },
    { id: "tenant_sign", label: "Signature" },
  ],
  provider: [
    { id: "provider_profile", label: "Profil" },
    { id: "provider_services", label: "Services" },
    { id: "provider_ops", label: "Zone" },
    { id: "provider_review", label: "Validation" },
  ],
  guarantor: [
    { id: "guarantor_context", label: "Informations" },
    { id: "guarantor_financial", label: "Finances" },
    { id: "guarantor_sign", label: "Signature" },
  ],
  admin: [],
  syndic: [
    { id: "syndic_site", label: "Site" },
    { id: "syndic_buildings", label: "Bâtiments" },
    { id: "syndic_units", label: "Lots" },
    { id: "syndic_tantiemes", label: "Tantièmes" },
    { id: "syndic_profile", label: "Profil" },
    { id: "syndic_complete", label: "Validation" },
  ],
};

/**
 * Hook principal pour gérer l'onboarding
 */
export function useOnboarding(
  profileId: string | null,
  userId: string | null,
  role: UserRole
) {
  const router = useRouter();

  // État
  const [state, setState] = useState<OnboardingState>({
    isLoading: true,
    isFirstLogin: false,
    showWelcomeModal: false,
    showTour: false,
    currentStep: 0,
    totalSteps: STEPS_CONFIG[role]?.length || 0,
    completedSteps: [],
    progressPercent: 0,
    analyticsId: null,
    error: null,
  });

  // Charger l'état initial
  useEffect(() => {
    if (!profileId || !userId) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    loadOnboardingState();
  }, [profileId, userId, role]);

  const loadOnboardingState = async () => {
    if (!profileId || !userId) return;

    try {
      // Récupérer l'état de première connexion
      const firstLoginState = await firstLoginService.getFirstLoginState(profileId);

      // Récupérer la progression
      const progress = await onboardingService.getOnboardingProgress(role);
      const completedSteps = progress
        .filter((p) => p.completed)
        .map((p) => {
          const stepIndex = STEPS_CONFIG[role]?.findIndex((s) => s.id === p.step);
          return stepIndex >= 0 ? stepIndex : -1;
        })
        .filter((i) => i >= 0);

      const progressPercent = Math.round(
        (completedSteps.length / (STEPS_CONFIG[role]?.length || 1)) * 100
      );

      // Récupérer ou créer la session d'analytics
      const analyticsId = await onboardingAnalyticsService.getOrCreateSession(
        userId,
        profileId,
        role
      );

      setState({
        isLoading: false,
        isFirstLogin: firstLoginState?.isFirstLogin ?? false,
        showWelcomeModal: !firstLoginState?.welcomeSeenAt && (firstLoginState?.loginCount ?? 0) <= 2,
        showTour: !!firstLoginState?.welcomeSeenAt && !firstLoginState?.tourCompletedAt,
        currentStep: completedSteps.length,
        totalSteps: STEPS_CONFIG[role]?.length || 0,
        completedSteps,
        progressPercent,
        analyticsId,
        error: null,
      });
    } catch (error: unknown) {
      console.error("Erreur chargement état onboarding:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
    }
  };

  // Actions
  const actions: OnboardingActions = {
    recordLogin: useCallback(async () => {
      if (!profileId) return;

      const result = await firstLoginService.recordLogin(profileId);
      if (result.isFirstLogin) {
        setState((prev) => ({
          ...prev,
          isFirstLogin: true,
          showWelcomeModal: true,
        }));
      }
    }, [profileId]),

    markWelcomeSeen: useCallback(async () => {
      if (!profileId) return;

      await firstLoginService.markWelcomeSeen(profileId);
      setState((prev) => ({
        ...prev,
        showWelcomeModal: false,
        showTour: true,
      }));
    }, [profileId]),

    startTour: useCallback(() => {
      setState((prev) => ({ ...prev, showTour: true }));
    }, []),

    completeTour: useCallback(async () => {
      if (!profileId) return;

      await firstLoginService.markTourCompleted(profileId);
      setState((prev) => ({ ...prev, showTour: false }));
    }, [profileId]),

    closeTour: useCallback(() => {
      setState((prev) => ({ ...prev, showTour: false }));
    }, []),

    startStep: useCallback(
      async (step: string) => {
        if (!state.analyticsId) return;
        await onboardingAnalyticsService.startStep(state.analyticsId, step);
      },
      [state.analyticsId]
    ),

    completeStep: useCallback(
      async (step: string) => {
        if (!profileId || !state.analyticsId) return;

        // Marquer l'étape comme complétée
        await onboardingService.markStepCompleted(step, role);
        await onboardingAnalyticsService.completeStep(state.analyticsId, step);

        // Mettre à jour l'état
        const stepIndex = STEPS_CONFIG[role]?.findIndex((s) => s.id === step);
        if (stepIndex >= 0) {
          const newCompleted = [...state.completedSteps, stepIndex];
          const newProgress = Math.round(
            (newCompleted.length / state.totalSteps) * 100
          );

          setState((prev) => ({
            ...prev,
            currentStep: stepIndex + 1,
            completedSteps: newCompleted,
            progressPercent: newProgress,
          }));

          // Envoyer notification de progression
          const userName = ""; // TODO: récupérer le nom
          await onboardingNotificationsService.sendStepCompletedNotification({
            profileId,
            userName,
            role,
            step,
            stepName: STEPS_CONFIG[role]?.[stepIndex]?.label,
            progressPercent: newProgress,
          });

          // Si à 80%+, envoyer notification "presque terminé"
          if (newProgress >= 80 && state.progressPercent < 80) {
            await onboardingNotificationsService.sendAlmostDoneNotification({
              profileId,
              userName,
              role,
              progressPercent: newProgress,
              remainingSteps: state.totalSteps - newCompleted.length,
            });
          }
        }
      },
      [profileId, role, state]
    ),

    skipStep: useCallback(
      async (step: string) => {
        if (!state.analyticsId) return;
        await onboardingAnalyticsService.skipStep(state.analyticsId, step);
      },
      [state.analyticsId]
    ),

    skipOnboarding: useCallback(async () => {
      if (!profileId) return;

      await firstLoginService.skipOnboarding(profileId);
      router.push(`/${role}/dashboard`);
    }, [profileId, role, router]),

    resumeOnboarding: useCallback(async () => {
      if (!profileId) return;

      await firstLoginService.resumeOnboarding(profileId);
      router.push(`/${role}/onboarding`);
    }, [profileId, role, router]),

    completeOnboarding: useCallback(async () => {
      if (!profileId || !state.analyticsId) return;

      // Marquer comme complété
      await firstLoginService.markOnboardingCompleted(profileId, role);
      await onboardingAnalyticsService.completeOnboarding(state.analyticsId);

      // Annuler les rappels programmés
      if (userId) {
        await onboardingNotificationsService.cancelPendingReminders(userId);
      }

      // Envoyer notification de complétion
      await onboardingNotificationsService.sendCompletedNotification({
        profileId,
        userName: "", // TODO: récupérer le nom
        role,
      });

      setState((prev) => ({
        ...prev,
        progressPercent: 100,
        completedSteps: Array.from({ length: prev.totalSteps }, (_, i) => i),
      }));

      router.push(`/${role}/dashboard`);
    }, [profileId, userId, role, state.analyticsId, router]),

    dismissTooltip: useCallback(
      async (featureKey: string) => {
        if (!profileId) return;
        await firstLoginService.dismissTooltip(profileId, featureKey);
      },
      [profileId]
    ),
  };

  return {
    ...state,
    steps: STEPS_CONFIG[role] || [],
    actions,
    refresh: loadOnboardingState,
  };
}

/**
 * Hook simplifié pour les composants qui ont juste besoin de la progression
 */
export function useOnboardingProgress(role: UserRole) {
  const [progress, setProgress] = useState({
    percent: 0,
    completed: 0,
    total: STEPS_CONFIG[role]?.length || 0,
    isComplete: false,
  });

  useEffect(() => {
    loadProgress();
  }, [role]);

  const loadProgress = async () => {
    const progressData = await onboardingService.getOnboardingProgress(role);
    const completedCount = progressData.filter((p) => p.completed).length;
    const total = STEPS_CONFIG[role]?.length || 1;

    setProgress({
      percent: Math.round((completedCount / total) * 100),
      completed: completedCount,
      total,
      isComplete: completedCount >= total,
    });
  };

  return { ...progress, refresh: loadProgress };
}

export default useOnboarding;
