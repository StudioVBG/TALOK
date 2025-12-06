"use client";

/**
 * SmartPaywall - Paywall intelligent SOTA 2025
 * Affiche un paywall contextuel avec animations et gamification
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSubscription } from "./subscription-provider";
import { UpgradeModal } from "./upgrade-modal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Sparkles,
  Zap,
  Gift,
  TrendingUp,
  Star,
  Lock,
  ArrowRight,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, type PlanSlug, type FeatureKey } from "@/lib/subscriptions/plans";

// ============================================
// TYPES
// ============================================

interface SmartPaywallProps {
  feature: FeatureKey;
  variant?: "banner" | "card" | "fullscreen" | "inline";
  className?: string;
  onDismiss?: () => void;
  /** Afficher une offre limitée */
  showLimitedOffer?: boolean;
  /** Texte personnalisé */
  customTitle?: string;
  customDescription?: string;
}

// ============================================
// CONFIGURATION VISUELLE
// ============================================

const FEATURE_VISUALS: Record<string, {
  icon: React.ElementType;
  gradient: string;
  accentColor: string;
  benefit: string;
}> = {
  edl_digital: {
    icon: CheckCircle2,
    gradient: "from-emerald-500 to-teal-600",
    accentColor: "emerald",
    benefit: "Gagnez 2h par état des lieux",
  },
  open_banking: {
    icon: TrendingUp,
    gradient: "from-blue-500 to-cyan-600",
    accentColor: "blue",
    benefit: "Synchronisation bancaire automatique",
  },
  scoring_tenant: {
    icon: Star,
    gradient: "from-amber-500 to-orange-600",
    accentColor: "amber",
    benefit: "Réduisez les impayés de 80%",
  },
  lease_generation: {
    icon: Zap,
    gradient: "from-violet-500 to-purple-600",
    accentColor: "violet",
    benefit: "Baux conformes en 2 minutes",
  },
  signatures: {
    icon: CheckCircle2,
    gradient: "from-indigo-500 to-blue-600",
    accentColor: "indigo",
    benefit: "Signature électronique légale",
  },
  auto_reminders: {
    icon: Clock,
    gradient: "from-rose-500 to-pink-600",
    accentColor: "rose",
    benefit: "Relances automatiques",
  },
  default: {
    icon: Crown,
    gradient: "from-violet-500 to-indigo-600",
    accentColor: "violet",
    benefit: "Débloquez des fonctionnalités premium",
  },
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function SmartPaywall({
  feature,
  variant = "card",
  className,
  onDismiss,
  showLimitedOffer = false,
  customTitle,
  customDescription,
}: SmartPaywallProps) {
  const { hasFeature, currentPlan, loading, usage } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600); // 1h en secondes

  // Timer pour offre limitée
  useEffect(() => {
    if (!showLimitedOffer) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [showLimitedOffer]);

  // Ne pas afficher si l'utilisateur a déjà accès
  if (hasFeature(feature) || loading) {
    return null;
  }

  const visual = FEATURE_VISUALS[feature] || FEATURE_VISUALS.default;
  const Icon = visual.icon;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ============================================
  // VARIANTE BANNER
  // ============================================
  if (variant === "banner") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn(
            "relative overflow-hidden rounded-xl border p-4",
            `bg-gradient-to-r ${visual.gradient}`,
            className
          )}
        >
          {/* Effet de brillance animé */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatDelay: 2,
            }}
          />

          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">
                  {customTitle || visual.benefit}
                </p>
                <p className="text-sm text-white/80">
                  {customDescription || "Passez à un forfait supérieur pour débloquer"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showLimitedOffer && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(timeLeft)}
                </Badge>
              )}
              <Button
                size="sm"
                onClick={() => setShowUpgrade(true)}
                className="bg-white text-slate-900 hover:bg-white/90 shadow-lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Débloquer
              </Button>
              {onDismiss && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onDismiss}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature={feature} />
      </>
    );
  }

  // ============================================
  // VARIANTE CARD
  // ============================================
  if (variant === "card") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xl",
            className
          )}
        >
          {/* Badge plan requis */}
          <div className="absolute top-4 right-4">
            <Badge className={`bg-gradient-to-r ${visual.gradient} text-white border-0`}>
              <Crown className="w-3 h-3 mr-1" />
              Premium
            </Badge>
          </div>

          {/* Icône centrale animée */}
          <div className="flex justify-center mb-6">
            <motion.div
              className={`p-4 rounded-2xl bg-gradient-to-br ${visual.gradient} shadow-lg`}
              animate={{
                boxShadow: [
                  "0 10px 40px -10px rgba(139, 92, 246, 0.3)",
                  "0 20px 60px -10px rgba(139, 92, 246, 0.5)",
                  "0 10px 40px -10px rgba(139, 92, 246, 0.3)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Lock className="w-8 h-8 text-white" />
            </motion.div>
          </div>

          {/* Contenu */}
          <div className="text-center space-y-4">
            <h3 className="text-xl font-bold text-slate-900">
              {customTitle || "Fonctionnalité Premium"}
            </h3>
            <p className="text-slate-600">
              {customDescription || visual.benefit}
            </p>

            {/* Avantages animés */}
            <motion.ul className="space-y-2 text-left">
              {["Accès illimité", "Support prioritaire", "Mises à jour incluses"].map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <CheckCircle2 className={`w-4 h-4 text-${visual.accentColor}-500`} />
                  {item}
                </motion.li>
              ))}
            </motion.ul>

            {/* CTA */}
            <Button
              onClick={() => setShowUpgrade(true)}
              className={`w-full bg-gradient-to-r ${visual.gradient} hover:opacity-90 text-white shadow-lg`}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Débloquer maintenant
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            {/* Offre limitée */}
            {showLimitedOffer && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-2 text-sm text-amber-600"
              >
                <Gift className="w-4 h-4" />
                <span>-20% les premières 24h</span>
                <Badge variant="outline" className="border-amber-300 text-amber-600">
                  {formatTime(timeLeft)}
                </Badge>
              </motion.div>
            )}
          </div>
        </motion.div>

        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature={feature} />
      </>
    );
  }

  // ============================================
  // VARIANTE INLINE
  // ============================================
  if (variant === "inline") {
    return (
      <>
        <motion.button
          onClick={() => setShowUpgrade(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 text-left transition-colors hover:border-violet-400 hover:bg-violet-50/50",
            className
          )}
        >
          <div className={`p-2 rounded-lg bg-gradient-to-br ${visual.gradient}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">
              {customTitle || "Débloquer cette fonctionnalité"}
            </p>
            <p className="text-xs text-slate-500">{visual.benefit}</p>
          </div>
          <Badge variant="outline" className="text-violet-600 border-violet-300">
            <Sparkles className="w-3 h-3 mr-1" />
            Pro
          </Badge>
        </motion.button>

        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature={feature} />
      </>
    );
  }

  // ============================================
  // VARIANTE FULLSCREEN
  // ============================================
  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4",
            className
          )}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-w-lg w-full bg-white rounded-3xl p-8 shadow-2xl"
          >
            {onDismiss && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onDismiss}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </Button>
            )}

            {/* Animation centrale */}
            <div className="flex justify-center mb-8">
              <motion.div
                className={`relative p-6 rounded-3xl bg-gradient-to-br ${visual.gradient}`}
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(139, 92, 246, 0)",
                    "0 0 0 20px rgba(139, 92, 246, 0.1)",
                    "0 0 0 40px rgba(139, 92, 246, 0)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Icon className="w-12 h-12 text-white" />
                <motion.div
                  className="absolute -top-2 -right-2"
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Crown className="w-6 h-6 text-amber-400" />
                </motion.div>
              </motion.div>
            </div>

            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-slate-900">
                {customTitle || "Passez au niveau supérieur"}
              </h2>
              <p className="text-slate-600 max-w-sm mx-auto">
                {customDescription || `Débloquez ${visual.benefit.toLowerCase()} et bien plus encore avec nos forfaits premium.`}
              </p>

              {/* Prix */}
              <div className="py-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                    {(PLANS.solo.price_monthly / 100).toFixed(0)}€
                  </span>
                  <span className="text-slate-500">/mois</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  ou {(PLANS.solo.price_yearly / 100).toFixed(0)}€/an (-17%)
                </p>
              </div>

              <Button
                size="lg"
                onClick={() => setShowUpgrade(true)}
                className={`w-full bg-gradient-to-r ${visual.gradient} hover:opacity-90 text-white text-lg py-6 shadow-lg`}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Commencer maintenant
              </Button>

              <p className="text-xs text-slate-400">
                1er mois offert • Sans engagement • Annulation facile
              </p>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature={feature} />
    </>
  );
}

// ============================================
// COMPOSANT TRIGGER D'UPGRADE INTELLIGENT
// ============================================

interface UpgradeTriggerProps {
  className?: string;
  variant?: "minimal" | "prominent" | "floating";
}

export function UpgradeTrigger({ className, variant = "prominent" }: UpgradeTriggerProps) {
  const { currentPlan, usage, loading } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (loading || currentPlan === "enterprise") {
    return null;
  }

  const propertiesUsed = usage?.properties_count || 0;
  const propertiesLimit = PLANS[currentPlan].limits.max_properties;
  const usagePercentage = propertiesLimit > 0 ? (propertiesUsed / propertiesLimit) * 100 : 0;

  // Variante minimale
  if (variant === "minimal") {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowUpgrade(true)}
          className={cn("text-violet-600 hover:text-violet-700 hover:bg-violet-50", className)}
        >
          <Sparkles className="w-4 h-4 mr-1" />
          Upgrader
        </Button>
        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      </>
    );
  }

  // Variante flottante
  if (variant === "floating") {
    return (
      <>
        <motion.button
          onClick={() => setShowUpgrade(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-white shadow-lg shadow-violet-500/30",
            className
          )}
        >
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Crown className="w-5 h-5" />
          </motion.div>
          <span className="font-medium">Passer Pro</span>
        </motion.button>
        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      </>
    );
  }

  // Variante proéminente (default)
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Forfait {PLANS[currentPlan].name}
              </p>
              <p className="text-sm text-slate-600">
                {propertiesUsed}/{propertiesLimit === -1 ? "∞" : propertiesLimit} biens utilisés
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setShowUpgrade(true)}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Upgrader
          </Button>
        </div>

        {propertiesLimit > 0 && (
          <div className="mt-4">
            <Progress
              value={usagePercentage}
              className="h-2 bg-violet-100"
            />
            <p className="text-xs text-slate-500 mt-1">
              {usagePercentage >= 80 ? (
                <span className="text-amber-600 font-medium">
                  ⚠️ Limite bientôt atteinte
                </span>
              ) : (
                `${Math.round(100 - usagePercentage)}% de capacité restante`
              )}
            </p>
          </div>
        )}
      </motion.div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
}

export default SmartPaywall;

