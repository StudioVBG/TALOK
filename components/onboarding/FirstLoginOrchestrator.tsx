"use client";

/**
 * FirstLoginOrchestrator
 *
 * Orchestre le flux de première connexion :
 * 1. Détecte si c'est un premier/deuxième login
 * 2. Affiche le WelcomeModal
 * 3. Au clic "Commencer", démarre le tour guidé
 * 4. Au clic "Plus tard", marque comme skipped
 *
 * Persiste l'état dans Supabase (tour_completed_at, welcome_seen_at)
 * avec fallback localStorage.
 */

import { useState, useEffect } from "react";
import { useOnboardingTour } from "./OnboardingTour";
import { WelcomeModal } from "./welcome-modal";
import type { UserRole } from "@/lib/types";

interface FirstLoginOrchestratorProps {
  profileId: string;
  role: UserRole;
  userName: string;
}

export function FirstLoginOrchestrator({
  profileId,
  role,
  userName,
}: FirstLoginOrchestratorProps) {
  const { startTour, hasCompletedTour } = useOnboardingTour();
  const [showWelcome, setShowWelcome] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!profileId || hasCompletedTour) {
      setChecked(true);
      return;
    }

    // Check localStorage first for speed
    const welcomeSeen = localStorage.getItem("lokatif-welcome-seen");
    if (welcomeSeen === "true") {
      setChecked(true);
      return;
    }

    // Check Supabase for welcome_seen_at
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase
        .from("profiles")
        .select("welcome_seen_at, login_count, tour_completed_at")
        .eq("id", profileId)
        .single()
        .then(({ data }) => {
          if (data?.tour_completed_at) {
            // Tour already completed, nothing to show
            localStorage.setItem("lokatif-welcome-seen", "true");
            setChecked(true);
            return;
          }

          if (!data?.welcome_seen_at && (data?.login_count ?? 0) <= 3) {
            // First few logins, welcome not yet seen → show modal
            setShowWelcome(true);
          } else if (data?.welcome_seen_at) {
            // Welcome already seen, sync to localStorage
            localStorage.setItem("lokatif-welcome-seen", "true");
          }

          setChecked(true);
        })
        .catch(() => {
          setChecked(true);
        });
    });
  }, [profileId, hasCompletedTour]);

  const handleStartOnboarding = () => {
    // Mark welcome as seen
    localStorage.setItem("lokatif-welcome-seen", "true");
    setShowWelcome(false);

    // Persist to Supabase
    if (profileId) {
      import("@/lib/supabase/client").then(({ createClient }) => {
        const supabase = createClient();
        supabase
          .from("profiles")
          .update({ welcome_seen_at: new Date().toISOString() })
          .eq("id", profileId)
          .then(({ error }) => {
            if (error) console.warn("[FirstLoginOrchestrator] Failed to mark welcome seen:", error);
          });
      });
    }

    // Start the tour
    startTour();
  };

  const handleSkipOnboarding = () => {
    localStorage.setItem("lokatif-welcome-seen", "true");
    setShowWelcome(false);

    // Persist skip to Supabase
    if (profileId) {
      import("@/lib/supabase/client").then(({ createClient }) => {
        const supabase = createClient();
        supabase
          .from("profiles")
          .update({
            welcome_seen_at: new Date().toISOString(),
            onboarding_skipped_at: new Date().toISOString(),
          })
          .eq("id", profileId)
          .then(({ error }) => {
            if (error) console.warn("[FirstLoginOrchestrator] Failed to mark skip:", error);
          });
      });
    }
  };

  const handleClose = () => {
    setShowWelcome(false);
  };

  if (!checked || !showWelcome) return null;

  return (
    <WelcomeModal
      open={showWelcome}
      onClose={handleClose}
      onStartOnboarding={handleStartOnboarding}
      onSkipOnboarding={handleSkipOnboarding}
      userName={userName}
      role={role}
    />
  );
}
