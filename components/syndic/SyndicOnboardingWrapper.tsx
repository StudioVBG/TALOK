"use client";

/**
 * SyndicOnboardingWrapper
 *
 * Wraps syndic children with the OnboardingTourProvider and mounts
 * FirstLoginOrchestrator (which triggers the WelcomeModal + guided tour
 * on the first few logins).
 *
 * Client component — injected inside the Server `SyndicLayout` so the
 * server-side role check stays untouched.
 */

import type { ReactNode } from "react";
import {
  OnboardingTourProvider,
  FirstLoginOrchestrator,
  AutoTourPrompt,
} from "@/components/onboarding";

interface SyndicOnboardingWrapperProps {
  children: ReactNode;
  profileId: string;
  userName: string;
}

export function SyndicOnboardingWrapper({
  children,
  profileId,
  userName,
}: SyndicOnboardingWrapperProps) {
  return (
    <OnboardingTourProvider role="syndic" profileId={profileId}>
      {children}
      <AutoTourPrompt />
      <FirstLoginOrchestrator
        profileId={profileId}
        role="syndic"
        userName={userName}
      />
    </OnboardingTourProvider>
  );
}
