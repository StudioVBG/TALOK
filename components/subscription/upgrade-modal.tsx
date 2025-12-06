"use client";

/**
 * UpgradeModal - Modal pour upgrader son forfait
 * Affiche les plans disponibles avec les features gagnées
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
  getPlanLevel,
  getYearlyDiscount,
} from "@/lib/subscriptions/plans";
import {
  Sparkles,
  Check,
  ArrowRight,
  Loader2,
  Zap,
  Crown,
  Building2,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: FeatureKey;
  requiredPlan?: PlanSlug;
}

export function UpgradeModal({ open, onClose, feature, requiredPlan }: UpgradeModalProps) {
  const { currentPlan, subscription } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<PlanSlug | null>(requiredPlan || null);
  const [billing, setBilling] = useState<"monthly" | "yearly">(
    subscription?.billing_cycle || "yearly"
  );
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Plans disponibles pour upgrade
  const availablePlans = (["confort", "pro", "enterprise"] as PlanSlug[]).filter(
    (slug) => getPlanLevel(slug) > getPlanLevel(currentPlan)
  );

  // Features gagnées pour le plan sélectionné
  const gainedFeatures = selectedPlan
    ? getUpgradeFeatures(currentPlan, selectedPlan)
    : [];

  const handleUpgrade = async (planSlug: PlanSlug) => {
    if (planSlug === "enterprise") {
      router.push("/contact?subject=enterprise");
      onClose();
      return;
    }

    setLoading(planSlug);

    try {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const getPlanIcon = (slug: PlanSlug) => {
    switch (slug) {
      case "confort":
        return <Star className="w-5 h-5" />;
      case "pro":
        return <Zap className="w-5 h-5" />;
      case "enterprise":
        return <Crown className="w-5 h-5" />;
      default:
        return <Building2 className="w-5 h-5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-slate-700/50 p-0 overflow-hidden">
        {/* Header avec gradient */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-700/50">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-indigo-500/10" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold text-white">
                Débloquez plus de fonctionnalités
              </DialogTitle>
            </div>
            {feature && (
              <DialogDescription className="text-slate-400">
                La fonctionnalité &quot;{FEATURE_LABELS[feature]?.label}&quot; nécessite le
                plan {requiredPlan ? PLANS[requiredPlan].name : "supérieur"}.
              </DialogDescription>
            )}
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Toggle mensuel/annuel */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-800/50 border border-slate-700/50">
              <button
                onClick={() => setBilling("monthly")}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  billing === "monthly"
                    ? "bg-white text-slate-900 shadow-md"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                  billing === "yearly"
                    ? "bg-white text-slate-900 shadow-md"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Annuel
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  -17%
                </Badge>
              </button>
            </div>
          </div>

          {/* Plans cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {availablePlans.map((slug, index) => {
                const plan = PLANS[slug];
                const isSelected = selectedPlan === slug;
                const isLoading = loading === slug;
                const isRecommended = requiredPlan === slug || plan.is_popular;
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
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "relative rounded-xl border-2 p-4 transition-all cursor-pointer",
                      isSelected
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                    )}
                    onClick={() => setSelectedPlan(slug)}
                  >
                    {/* Badge recommandé */}
                    {isRecommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white border-0 shadow-lg">
                          {plan.badge || "Recommandé"}
                        </Badge>
                      </div>
                    )}

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isSelected
                            ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
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
                              /{billing === "yearly" ? "an" : "mois"}
                            </span>
                          </div>
                          {monthlyEquivalent && (
                            <p className="text-xs text-slate-500 mt-1">
                              soit {formatPrice(monthlyEquivalent)}/mois
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-xl font-bold text-white">Sur devis</span>
                      )}
                    </div>

                    {/* Highlights */}
                    <ul className="space-y-2 mb-4">
                      {plan.highlights.slice(0, 4).map((highlight, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-300">{highlight}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Button
                      className={cn(
                        "w-full",
                        isSelected
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
                          : "bg-slate-700 hover:bg-slate-600"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpgrade(slug);
                      }}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : slug === "enterprise" ? (
                        <>
                          Nous contacter
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      ) : (
                        <>
                          {plan.cta_text}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Features gagnées */}
          {selectedPlan && gainedFeatures.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
            >
              <h4 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Fonctionnalités débloquées avec {PLANS[selectedPlan].name}
              </h4>
              <div className="flex flex-wrap gap-2">
                {gainedFeatures.slice(0, 8).map((feat) => (
                  <Badge
                    key={feat}
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                  >
                    <Check className="w-3 h-3 mr-1" />
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

          {/* Footer */}
          <div className="text-center text-sm text-slate-500">
            <p>
              {billing === "yearly" && "💰 Économisez jusqu'à 17% avec le paiement annuel • "}
              ✅ 1er mois offert • 🔒 Paiement sécurisé par Stripe
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;

