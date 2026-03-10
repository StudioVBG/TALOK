"use client";

/**
 * UsageLimitBanner - Bannière d'avertissement quand une limite est proche ou atteinte
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSubscription, useUsageLimit } from "./subscription-provider";
import { UpgradeModal } from "./upgrade-modal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, X, Sparkles, TrendingUp, Home, FileText, Users, PenTool, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/subscriptions/plans";

interface UsageLimitBannerProps {
  resource: "properties" | "leases" | "users" | "signatures" | "tenants";
  className?: string;
  dismissible?: boolean;
  /** Seuil d'affichage (default: 80%) */
  threshold?: number;
  variant?: "inline" | "floating" | "card";
}

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  properties: Home,
  leases: FileText,
  users: Users,
  signatures: PenTool,
  tenants: UserCheck,
};

const RESOURCE_LABELS: Record<string, { singular: string; plural: string }> = {
  properties: { singular: "bien", plural: "biens" },
  leases: { singular: "bail", plural: "baux" },
  users: { singular: "utilisateur", plural: "utilisateurs" },
  signatures: { singular: "signature", plural: "signatures" },
  tenants: { singular: "locataire", plural: "locataires" },
};

export function UsageLimitBanner({
  resource,
  className,
  dismissible = true,
  threshold = 80,
  variant = "inline",
}: UsageLimitBannerProps) {
  const { currentPlan } = useSubscription();
  const { canAdd, remaining, percentage, isAtLimit } = useUsageLimit(resource);
  const [dismissed, setDismissed] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const label = RESOURCE_LABELS[resource];
  const limitKey = resource === "signatures" ? "signatures_monthly_quota" : `max_${resource}`;
  const limit = (PLANS[currentPlan].limits as unknown as Record<string, number>)[limitKey] as number;

  const planConfig = PLANS[currentPlan];
  const hasExtraPropertyBilling = resource === "properties" && planConfig.limits.extra_property_price > 0;

  // Ne pas afficher si en dessous du seuil, si illimité, ou si le plan permet des biens supplémentaires payants
  if (limit === -1 || percentage < threshold || dismissed || hasExtraPropertyBilling) {
    return null;
  }

  const isWarning = !isAtLimit && percentage >= threshold;
  const isCritical = isAtLimit;

  // Variante inline
  if (variant === "inline") {
    return (
      <>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              "rounded-lg border p-4",
              isCritical
                ? "bg-red-500/10 border-red-500/30"
                : "bg-amber-500/10 border-amber-500/30",
              className
            )}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={cn(
                  "w-5 h-5 flex-shrink-0 mt-0.5",
                  isCritical ? "text-red-400" : "text-amber-400"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <h4
                    className={cn(
                      "font-medium",
                      isCritical ? "text-red-300" : "text-amber-300"
                    )}
                  >
                    {isCritical
                      ? `Limite de ${label.plural} atteinte`
                      : `Vous approchez de la limite de ${label.plural}`}
                  </h4>
                  {dismissible && (
                    <button
                      onClick={() => setDismissed(true)}
                      className="text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-400 mb-3">
                  {isCritical
                    ? `Vous avez atteint votre limite de ${limit} ${limit > 1 ? label.plural : label.singular}. Passez au plan supérieur pour continuer.`
                    : `Il vous reste ${remaining} ${remaining > 1 ? label.plural : label.singular} sur votre forfait ${PLANS[currentPlan].name}.`}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Progress
                      value={percentage}
                      className={cn(
                        "h-2",
                        isCritical ? "bg-red-500/20" : "bg-amber-500/20"
                      )}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {limit - remaining}/{limit} utilisés
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowUpgrade(true)}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Upgrader
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      </>
    );
  }

  // Variante floating (bottom of screen)
  if (variant === "floating") {
    return (
      <>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className={cn(
              "fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border shadow-2xl p-4",
              isCritical
                ? "bg-red-950 border-red-500/30"
                : "bg-amber-950 border-amber-500/30",
              className
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  isCritical ? "bg-red-500/20" : "bg-amber-500/20"
                )}
              >
                {React.createElement(RESOURCE_ICONS[resource], { className: "w-5 h-5" })}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h4
                    className={cn(
                      "font-semibold",
                      isCritical ? "text-red-300" : "text-amber-300"
                    )}
                  >
                    {isCritical ? "Limite atteinte" : "Limite bientôt atteinte"}
                  </h4>
                  {dismissible && (
                    <button
                      onClick={() => setDismissed(true)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1 mb-3">
                  {remaining} {label.plural} restants sur {limit}
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowUpgrade(true)}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Augmenter ma limite
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      </>
    );
  }

  // Variante card (compact)
  return (
    <>
      <div
        className={cn(
          "rounded-lg border p-3 cursor-pointer hover:border-violet-500/50 transition-colors",
          isCritical
            ? "bg-red-500/10 border-red-500/30"
            : "bg-amber-500/10 border-amber-500/30",
          className
        )}
        onClick={() => setShowUpgrade(true)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {React.createElement(RESOURCE_ICONS[resource], { className: "w-4 h-4 text-slate-400" })}
            <div>
              <p className="text-sm font-medium text-white">
                {limit - remaining}/{limit} {label.plural}
              </p>
              <p className="text-xs text-slate-500">
                {remaining > 0 ? `${remaining} restants` : "Limite atteinte"}
              </p>
            </div>
          </div>
          <Progress
            value={percentage}
            className={cn(
              "w-20 h-2",
              isCritical ? "bg-red-500/20" : "bg-amber-500/20"
            )}
          />
        </div>
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
}

/**
 * UsageMeter - Jauge d'usage animée
 */
interface UsageMeterProps {
  resource: "properties" | "leases" | "users" | "signatures";
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UsageMeter({
  resource,
  showLabel = true,
  size = "md",
  className,
}: UsageMeterProps) {
  const { currentPlan, usage } = useSubscription();
  const { percentage, isAtLimit } = useUsageLimit(resource);
  const limitKey = resource === "signatures" ? "signatures_monthly_quota" : `max_${resource}`;
  const limit = (PLANS[currentPlan].limits as unknown as Record<string, number>)[limitKey] as number;
  const meterPlanConfig = PLANS[currentPlan];
  const meterHasExtraBilling = resource === "properties" && meterPlanConfig.limits.extra_property_price > 0;
  const used = usage?.[resource]?.used ?? 0;

  // Pour les plans avec biens supplémentaires payants, afficher par rapport aux biens inclus
  const displayLimit = meterHasExtraBilling ? meterPlanConfig.limits.included_properties : limit;

  if (limit === -1) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {showLabel && (
          <span className="text-sm text-slate-400 flex items-center gap-1">{React.createElement(RESOURCE_ICONS[resource], { className: "w-3.5 h-3.5" })} Illimité</span>
        )}
      </div>
    );
  }

  const sizeClasses = {
    sm: "h-1.5 w-16",
    md: "h-2 w-24",
    lg: "h-3 w-32",
  };

  const getColor = () => {
    if (isAtLimit) return "bg-red-500";
    if (percentage >= 80) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLabel && (
        <span className="text-xs text-slate-500">
          {used}/{displayLimit}{meterHasExtraBilling ? "+" : ""}
        </span>
      )}
      <div className={cn("rounded-full bg-slate-700/50 overflow-hidden", sizeClasses[size])}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, percentage)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={cn("h-full rounded-full", getColor())}
        />
      </div>
    </div>
  );
}

export default UsageLimitBanner;

