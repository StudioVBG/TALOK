"use client";

/**
 * SyndicPlanBanner — Bannière persistante affichée quand le plan actuel
 * n'inclut pas `copro_module` (typiquement Gratuit ou Starter).
 *
 * Ne s'affiche PAS pour les plans Confort, Pro, Enterprise S/M/L/XL.
 * Utilise `hasPlanFeature()` de `lib/subscriptions/plans.ts` comme
 * source de vérité : si le flag bascule sur un plan supérieur, la
 * bannière s'adapte automatiquement.
 *
 * Sprint 2 — S2-4
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { hasPlanFeature, type PlanSlug } from "@/lib/subscriptions/plans";

interface SubscriptionStatusResponse {
  has_subscription: boolean;
  selected_plan_at: string | null;
  plan_slug: PlanSlug | null;
  status?: string | null;
}

interface SyndicPlanBannerProps {
  /** Si true, style "modal complet" pour la fin d'onboarding. Sinon bandeau compact. */
  variant?: "banner" | "onboarding";
  /** Si true (par défaut), permet à l'utilisateur de fermer le bandeau. */
  dismissible?: boolean;
}

const STORAGE_KEY = "talok_syndic_plan_banner_dismissed";

export function SyndicPlanBanner({
  variant = "banner",
  dismissible = true,
}: SyndicPlanBannerProps) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Lire le flag de dismissal depuis localStorage (bandeau seul)
    if (dismissible && typeof window !== "undefined" && variant === "banner") {
      if (localStorage.getItem(STORAGE_KEY) === "true") {
        setDismissed(true);
      }
    }

    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/me/subscription-status", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          setBlocked(false);
          return;
        }
        const data = (await response.json()) as SubscriptionStatusResponse;
        const planSlug = data.plan_slug;

        // Si pas de plan_slug → considéré comme plan gratuit (bloqué)
        if (!planSlug) {
          setBlocked(true);
          return;
        }

        // Source de vérité : hasPlanFeature (lit lib/subscriptions/plans.ts)
        setBlocked(!hasPlanFeature(planSlug, "copro_module"));
      } catch (error) {
        // Erreur non bloquante — on n'affiche pas le bandeau par défaut
        console.warn("[SyndicPlanBanner] Impossible de charger le statut:", error);
        setBlocked(false);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [dismissible, variant]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  };

  // Skip le rendu tant qu'on ne sait pas + si user a accès + si dismissé
  if (loading || !blocked || dismissed) {
    return null;
  }

  // Variante "onboarding" : grosse carte de fin d'onboarding
  if (variant === "onboarding") {
    return (
      <div className="rounded-2xl border border-[#2563EB]/30 bg-[#2563EB]/5 p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#2563EB]/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#2563EB]" />
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="text-base sm:text-lg font-semibold text-foreground">
              Activez le module copropriété
            </h3>
            <p className="text-sm text-muted-foreground">
              Le module copropriété est disponible à partir du plan{" "}
              <strong className="text-foreground">Confort (35 €/mois)</strong>.
              Votre plan actuel ne permet pas encore d'accéder aux
              fonctionnalités de gestion de copropriété (assemblées,
              appels de fonds, conseils syndicaux, fonds travaux loi ALUR…).
            </p>
          </div>
        </div>
        <Link
          href="/syndic/settings/subscription"
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#2563EB]/90 transition-colors"
        >
          Choisir un plan
        </Link>
      </div>
    );
  }

  // Variante "banner" : bandeau persistant compact en haut du dashboard
  return (
    <div
      role="region"
      aria-label="Module copropriété non activé"
      className="mb-4 sm:mb-6 rounded-xl border border-[#2563EB]/30 bg-gradient-to-r from-[#2563EB]/10 to-[#2563EB]/5 px-3 py-2.5 sm:px-4 sm:py-3"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="shrink-0 w-4 h-4 sm:w-5 sm:h-5 text-[#2563EB] mt-0.5" />
        <div className="flex-1 min-w-0 text-sm">
          <p className="text-foreground">
            <span className="font-semibold">Module copropriété non activé</span>
            <span className="hidden sm:inline"> — </span>
            <span className="block sm:inline text-muted-foreground">
              Passez au plan Confort pour débloquer toutes les fonctionnalités.
            </span>
          </p>
          <Link
            href="/syndic/settings/subscription"
            className="inline-block mt-1 sm:mt-0 sm:ml-2 text-[#2563EB] font-semibold hover:underline"
          >
            Choisir un plan →
          </Link>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
            aria-label="Fermer ce message"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
