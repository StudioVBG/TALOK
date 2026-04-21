"use client";

/**
 * OnboardingWrapper
 *
 * Wrapper client générique à monter à l'intérieur d'un layout serveur.
 * Fournit :
 *   - OnboardingTourProvider (contexte du tour)
 *   - AutoTourPrompt (bannière "Nouveau sur Talok ?")
 *   - FirstLoginOrchestrator (WelcomeModal + déclencheur tour)
 *
 * Fonctionne pour tous les rôles supportés par OnboardingTourProvider :
 * owner, tenant, syndic, provider, guarantor, agency, admin.
 */

import type { ReactNode } from "react";
import {
  OnboardingTourProvider,
  AutoTourPrompt,
  type TourRole,
} from "./OnboardingTour";
import { FirstLoginOrchestrator } from "./FirstLoginOrchestrator";
import type { UserRole } from "@/lib/types";

interface OnboardingWrapperProps {
  children: ReactNode;
  role: TourRole;
  profileId: string;
  userName: string;
}

export function OnboardingWrapper({
  children,
  role,
  profileId,
  userName,
}: OnboardingWrapperProps) {
  return (
    <OnboardingTourProvider role={role} profileId={profileId}>
      {children}
      <AutoTourPrompt />
      <FirstLoginOrchestrator
        profileId={profileId}
        role={role as UserRole}
        userName={userName}
      />
    </OnboardingTourProvider>
  );
}
