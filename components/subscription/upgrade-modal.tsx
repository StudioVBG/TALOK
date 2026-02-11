"use client";

/**
 * UpgradeModal - Modal pour changer de forfait (upgrade + downgrade)
 * Affiche tous les plans avec les features gagnées/perdues
 *
 * Conformité :
 * - Affichage HT/TTC (Art. L112-1 Code de la Consommation)
 * - Art. L215-1 Code de la Consommation (droit de changement tarifaire)
 * - WCAG 2.2 AA (ARIA, focus, contraste)
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "./subscription-provider";
import {
  PLANS,
  FEATURE_LABELS,
  type PlanSlug,
  type FeatureKey,
  formatPrice,
  getUpgradeFeatures,
  getDowngradeFeatures,
  getPlanLevel,
} from "@/lib/subscriptions/plans";
import {
  Sparkles,
  Check,
  ArrowRight,
  ArrowDown,
  Loader2,
  Zap,
  Crown,
  Building2,
  Star,
  Home,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: FeatureKey;
  requiredPlan?: PlanSlug;
}

const TVA_RATE = 20;

const ALL_PLANS: PlanSlug[] = [
  "gratuit",
  "starter",
  "confort",
  "pro",
  "enterprise_s",
  "enterprise_m",
  "enterprise_l",
  "enterprise_xl",
];

export function UpgradeModal({ open, onClose, feature, requiredPlan }: UpgradeModalProps) {
  const { currentPlan, subscription, refresh } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<PlanSlug | null>(requiredPlan || null);
  const [billing, setBilling] = useState<"monthly" | "yearly">(
    subscription?.billing_cycle || "yearly"
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState<PlanSlug | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const currentLevel = getPlanLevel(currentPlan);

  // Plans disponibles (tous sauf le plan actuel)
  const availablePlans = ALL_PLANS.filter(
    (slug) => slug !== currentPlan && slug !== "enterprise"
  );

  // Determiner si c'est un upgrade ou un downgrade
  const isDowngrade = (slug: PlanSlug) => getPlanLevel(slug) < currentLevel;
  const isUpgrade = (slug: PlanSlug) => getPlanLevel(slug) > currentLevel;

  // Features gagnées/perdues pour le plan sélectionné
  const gainedFeatures = selectedPlan && isUpgrade(selectedPlan)
    ? getUpgradeFeatures(currentPlan, selectedPlan)
    : [];
  const lostFeatures = selectedPlan && isDowngrade(selectedPlan)
    ? getDowngradeFeatures(currentPlan, selectedPlan)
    : [];

  const handleChangePlan = async (planSlug: PlanSlug) => {
    // Enterprise L et XL nécessitent un contact
    if (planSlug === "enterprise_l" || planSlug === "enterprise_xl") {
      router.push("/contact?subject=enterprise");
      onClose();
      return;
    }

    // Downgrade: confirmer d'abord
    if (isDowngrade(planSlug) && showDowngradeConfirm !== planSlug) {
      setShowDowngradeConfirm(planSlug);
      setSelectedPlan(planSlug);
      return;
    }

    setLoading(planSlug);

    try {
      if (isDowngrade(planSlug)) {
        // Downgrade via change-plan API
        const response = await fetch("/api/subscriptions/change-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_slug: planSlug,
            billing_cycle: billing,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Erreur lors du changement de forfait");
        }

        toast({
          title: "Forfait modifié",
          description: `Votre forfait passera à ${PLANS[planSlug].name} à la fin de la période en cours.`,
        });
        await refresh();
        onClose();
      } else {
        // Upgrade via Stripe Checkout
        const response = await fetch("/api/subscriptions/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_slug: planSlug,
            billing_cycle: billing,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Erreur lors de la création du checkout");
        }

        // Redirect to Stripe Checkout
        window.location.href = data.url;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
      setShowDowngradeConfirm(null);
    }
  };

  const isContactPlan = (slug: PlanSlug) =>
    slug === "enterprise_l" || slug === "enterprise_xl";

  const getPlanIcon = (slug: PlanSlug) => {
    switch (slug) {
      case "gratuit":
        return <Home className="w-5 h-5" />;
      case "starter":
        return <Home className="w-5 h-5" />;
      case "confort":
        return <Star className="w-5 h-5" />;
      case "pro":
        return <Zap className="w-5 h-5" />;
      case "enterprise_s":
      case "enterprise_m":
        return <Building2 className="w-5 h-5" />;
      case "enterprise_l":
      case "enterprise_xl":
        return <Crown className="w-5 h-5" />;
      default:
        return <Building2 className="w-5 h-5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setShowDowngradeConfirm(null); } onClose(); }}>
      <DialogContent className="max-w-4xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-slate-700/50 p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header avec gradient */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-700/50">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-indigo-500/10" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Sparkles className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <DialogTitle className="text-xl font-bold text-white">
                Changer de forfait
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-400">
              {feature ? (
                <>La fonctionnalité &quot;{FEATURE_LABELS[feature]?.label}&quot; nécessite le
                plan {requiredPlan ? PLANS[requiredPlan].name : "supérieur"}.</>
              ) : (
                <>Forfait actuel : <strong className="text-white">{PLANS[currentPlan].name}</strong>. Choisissez un forfait ci-dessous pour upgrader ou downgrader.</>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Toggle mensuel/annuel */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-800/50 border border-slate-700/50" role="radiogroup" aria-label="Cycle de facturation">
              <button
                onClick={() => setBilling("monthly")}
                role="radio"
                aria-checked={billing === "monthly"}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  billing === "monthly"
                    ? "bg-white text-slate-900 shadow-md"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBilling("yearly")}
                role="radio"
                aria-checked={billing === "yearly"}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  billing === "yearly"
                    ? "bg-white text-slate-900 shadow-md"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Annuel
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  -20%
                </Badge>
              </button>
            </div>
          </div>

          {/* Plans cards */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {availablePlans.map((slug, index) => {
                const plan = PLANS[slug];
                const isSelected = selectedPlan === slug;
                const isLoading = loading === slug;
                const isRecommended = requiredPlan === slug || plan.is_popular;
                const isDown = isDowngrade(slug);
                const isCurrent = slug === currentPlan;
                const price = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
                const monthlyEquivalent =
                  billing === "yearly" && plan.price_yearly
                    ? Math.round(plan.price_yearly / 12)
                    : null;

                return (
                  <motion.div
                    key={slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "relative rounded-xl border-2 p-4 transition-all cursor-pointer",
                      isCurrent
                        ? "border-slate-500 bg-slate-700/20 opacity-50 cursor-default"
                        : isSelected
                          ? isDown
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-violet-500 bg-violet-500/10"
                          : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                    )}
                    onClick={() => {
                      if (!isCurrent) {
                        setSelectedPlan(slug);
                        setShowDowngradeConfirm(null);
                      }
                    }}
                    role="button"
                    tabIndex={isCurrent ? -1 : 0}
                    onKeyDown={(e) => { if (!isCurrent && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedPlan(slug); setShowDowngradeConfirm(null); }}}
                    aria-pressed={isSelected}
                  >
                    {/* Badge */}
                    {isRecommended && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white border-0 shadow-lg">
                          {plan.badge || "Recommandé"}
                        </Badge>
                      </div>
                    )}
                    {isDown && !isCurrent && (
                      <div className="absolute -top-3 right-3">
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                          <ArrowDown className="w-3 h-3 mr-1" />
                          Downgrade
                        </Badge>
                      </div>
                    )}

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isSelected && !isDown
                            ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
                            : isSelected && isDown
                              ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                              : "bg-slate-700/50 text-slate-400"
                        )}
                      >
                        {getPlanIcon(slug)}
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{plan.name}</h3>
                        <p className="text-xs text-slate-400">{plan.tagline}</p>
                      </div>
                    </div>

                    {/* Prix */}
                    <div className="mb-4">
                      {price !== null ? (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-white">
                              {formatPrice(price)}
                            </span>
                            <span className="text-slate-400 text-sm">
                              HT/{billing === "yearly" ? "an" : "mois"}
                            </span>
                          </div>
                          {monthlyEquivalent && (
                            <p className="text-xs text-slate-400 mt-1">
                              soit {formatPrice(monthlyEquivalent)} HT/mois
                            </p>
                          )}
                          {price > 0 && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatPrice(Math.round(price * (1 + TVA_RATE / 100)))} TTC
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-xl font-bold text-white">Sur devis</span>
                      )}
                    </div>

                    {/* Highlights */}
                    <ul className="space-y-2 mb-4">
                      {plan.highlights.slice(0, 3).map((highlight, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                          <span className="text-slate-300">{highlight}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {!isCurrent && (
                      <Button
                        className={cn(
                          "w-full",
                          isDown
                            ? "bg-amber-600 hover:bg-amber-500"
                            : isSelected
                              ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
                              : "bg-slate-700 hover:bg-slate-600"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChangePlan(slug);
                        }}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isContactPlan(slug) ? (
                          <>
                            Nous contacter
                            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                          </>
                        ) : isDown ? (
                          showDowngradeConfirm === slug ? (
                            <>Confirmer le downgrade</>
                          ) : (
                            <>
                              Passer à {plan.name}
                              <ArrowDown className="w-4 h-4 ml-2" aria-hidden="true" />
                            </>
                          )
                        ) : (
                          <>
                            {plan.cta_text || "Souscrire"}
                            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                          </>
                        )}
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Features gagnées (upgrade) */}
          {selectedPlan && gainedFeatures.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
            >
              <h4 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Fonctionnalités débloquées avec {PLANS[selectedPlan].name}
              </h4>
              <div className="flex flex-wrap gap-2">
                {gainedFeatures.slice(0, 8).map((feat) => (
                  <Badge
                    key={feat}
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                  >
                    <Check className="w-3 h-3 mr-1" aria-hidden="true" />
                    {FEATURE_LABELS[feat]?.label || feat}
                  </Badge>
                ))}
                {gainedFeatures.length > 8 && (
                  <Badge variant="outline" className="border-slate-600 text-slate-400">
                    +{gainedFeatures.length - 8} autres
                  </Badge>
                )}
              </div>
            </motion.div>
          )}

          {/* Features perdues (downgrade) */}
          {selectedPlan && lostFeatures.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-4 rounded-lg bg-red-500/10 border border-red-500/30"
            >
              <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                Fonctionnalités perdues en passant à {PLANS[selectedPlan].name}
              </h4>
              <div className="flex flex-wrap gap-2">
                {lostFeatures.slice(0, 8).map((feat) => (
                  <Badge
                    key={feat}
                    variant="outline"
                    className="border-red-500/30 text-red-300 bg-red-500/10"
                  >
                    <XCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                    {FEATURE_LABELS[feat]?.label || feat}
                  </Badge>
                ))}
                {lostFeatures.length > 8 && (
                  <Badge variant="outline" className="border-slate-600 text-slate-400">
                    +{lostFeatures.length - 8} autres
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Le changement prendra effet à la fin de votre période de facturation en cours.
                Conformément à l&apos;Art. L215-1 du Code de la Consommation.
              </p>
            </motion.div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-slate-500 space-y-1">
            <p>
              {billing === "yearly" && "Économisez jusqu'à 20% avec le paiement annuel — "}
              1er mois offert — Paiement sécurisé par Stripe
            </p>
            <p>
              Upgrade : paiement immédiat au prorata. Downgrade : effectif à la fin de la période.
            </p>
            <p>
              Prix HT. TVA {TVA_RATE}% en sus.{" "}
              <a href="/legal/cgv" className="underline hover:text-slate-300">CGV</a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;
