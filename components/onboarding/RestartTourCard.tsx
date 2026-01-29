"use client";

/**
 * RestartTourCard
 *
 * Carte de paramètres permettant de relancer le tour guidé.
 * À placer dans les pages de profil/settings.
 * Ne nécessite PAS d'être wrappé dans OnboardingTourProvider -
 * il reset les données localStorage + Supabase directement et
 * redirige vers le dashboard pour relancer le tour.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Sparkles, RotateCcw, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";

export function RestartTourCard() {
  const [isResetting, setIsResetting] = useState(false);
  const [hasReset, setHasReset] = useState(false);
  const router = useRouter();
  const { profile } = useAuth();

  const handleRestartTour = useCallback(async () => {
    setIsResetting(true);

    try {
      // Clear localStorage
      localStorage.removeItem("lokatif-tour-completed");
      localStorage.removeItem("lokatif-tour-prompt-dismissed");
      localStorage.removeItem("lokatif-welcome-seen");

      // Clear Supabase (non-blocking)
      if (profile?.id) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await supabase
          .from("profiles")
          .update({ tour_completed_at: null })
          .eq("id", profile.id);
      }

      setHasReset(true);

      // Redirect to dashboard after a short delay to show confirmation
      setTimeout(() => {
        const role = profile?.role || "owner";
        router.push(`/${role}/dashboard`);
      }, 1200);
    } catch (error) {
      console.error("[RestartTourCard] Error resetting tour:", error);
    } finally {
      setIsResetting(false);
    }
  }, [profile, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          Tour guidé
        </CardTitle>
        <CardDescription>
          Relancez le tour de présentation de l'application pour redécouvrir les fonctionnalités.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasReset ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Tour réinitialisé ! Redirection...</span>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={handleRestartTour}
            disabled={isResetting}
            className="gap-2"
          >
            {isResetting ? (
              <>
                <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                Réinitialisation...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Revoir le tutoriel
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
