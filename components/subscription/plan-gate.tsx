"use client";

/**
 * PlanGate - Composant pour bloquer l'accès aux fonctionnalités premium
 * Affiche le contenu si l'utilisateur a la feature, sinon affiche un overlay
 */

import React, { useState } from "react";
import { useSubscription } from "./subscription-provider";
import { UpgradeModal } from "./upgrade-modal";
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { type FeatureKey, getRequiredPlanForFeature, FEATURE_LABELS, PLANS } from "@/lib/subscriptions/plans";

interface PlanGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  /** Mode: 'block' empêche l'accès, 'blur' floute le contenu */
  mode?: "block" | "blur" | "hide";
  /** Message personnalisé */
  message?: string;
  /** Affiche un badge au lieu de bloquer */
  badgeOnly?: boolean;
}

export function PlanGate({
  feature,
  children,
  fallback,
  className,
  mode = "block",
  message,
  badgeOnly = false,
}: PlanGateProps) {
  const { hasFeature, loading, currentPlan } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const hasAccess = hasFeature(feature);
  const requiredPlan = getRequiredPlanForFeature(feature);
  const featureLabel = FEATURE_LABELS[feature];

  // Loading state
  if (loading) {
    return (
      <div className={cn("animate-pulse bg-slate-800/50 rounded-lg", className)}>
        {children}
      </div>
    );
  }

  // Has access
  if (hasAccess) {
    return <>{children}</>;
  }

  // Badge only mode - affiche un badge à côté du contenu
  if (badgeOnly) {
    return (
      <div className="relative">
        {children}
        <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
          {PLANS[requiredPlan].name}
        </span>
      </div>
    );
  }

  // Hide mode - ne montre rien
  if (mode === "hide") {
    return fallback || null;
  }

  // Custom fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default blocked/blurred view
  return (
    <>
      <div
        className={cn(
          "relative cursor-pointer group rounded-lg overflow-hidden",
          className
        )}
        onClick={() => setShowUpgrade(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setShowUpgrade(true)}
      >
        {/* Overlay */}
        <div
          className={cn(
            "absolute inset-0 z-10 flex items-center justify-center transition-all duration-300",
            mode === "blur"
              ? "backdrop-blur-sm bg-slate-900/60"
              : "bg-gradient-to-br from-slate-900/95 to-slate-800/95"
          )}
        >
          <div className="text-center p-6 max-w-xs">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30">
              <Lock className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {featureLabel?.label || "Fonctionnalité premium"}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {message || featureLabel?.description || "Cette fonctionnalité nécessite un forfait supérieur"}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium group-hover:from-violet-500 group-hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/25">
              <Sparkles className="w-4 h-4" />
              <span>Débloquer avec {PLANS[requiredPlan].name}</span>
            </div>
          </div>
        </div>

        {/* Contenu flouté/caché */}
        <div
          className={cn(
            "pointer-events-none select-none",
            mode === "blur" ? "blur-sm" : "opacity-20"
          )}
        >
          {children}
        </div>
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature={feature}
        requiredPlan={requiredPlan}
      />
    </>
  );
}

// ============================================
// VARIANTES
// ============================================

/**
 * PlanGateInline - Version inline pour les boutons/éléments interactifs
 */
interface PlanGateInlineProps {
  feature: FeatureKey;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function PlanGateInline({
  feature,
  children,
  onClick,
  className,
  disabled,
}: PlanGateInlineProps) {
  const { hasFeature, loading } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const hasAccess = hasFeature(feature);
  const requiredPlan = getRequiredPlanForFeature(feature);

  const handleClick = () => {
    if (hasAccess) {
      onClick?.();
    } else {
      setShowUpgrade(true);
    }
  };

  return (
    <>
      <div
        className={cn(
          "relative inline-flex items-center",
          !hasAccess && "cursor-pointer",
          className
        )}
        onClick={handleClick}
        role={hasAccess ? undefined : "button"}
        tabIndex={hasAccess ? undefined : 0}
        onKeyDown={(e) => !hasAccess && e.key === "Enter" && handleClick()}
      >
        <div className={cn(loading && "opacity-50", disabled && "pointer-events-none opacity-50")}>
          {children}
        </div>
        {!hasAccess && !loading && (
          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 uppercase">
            {PLANS[requiredPlan].name}
          </span>
        )}
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature={feature}
        requiredPlan={requiredPlan}
      />
    </>
  );
}

/**
 * PlanGateTooltip - Affiche un tooltip quand la feature est bloquée
 */
export function PlanGateTooltip({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
}) {
  const { hasFeature } = useSubscription();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  const requiredPlan = getRequiredPlanForFeature(feature);
  const featureLabel = FEATURE_LABELS[feature];

  return (
    <div className="relative group">
      <div className="opacity-50 cursor-not-allowed">{children}</div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
        <div className="flex items-center gap-2">
          <Lock className="w-3 h-3 text-amber-400" />
          <span>{featureLabel?.label} - Plan {PLANS[requiredPlan].name} requis</span>
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

// Export default
export default PlanGate;

