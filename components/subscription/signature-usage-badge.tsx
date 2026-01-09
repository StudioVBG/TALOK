"use client";

/**
 * SignatureUsageBadge - Affiche l'usage des signatures
 * Variantes: badge, card, inline, tooltip
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSignatureQuota } from "./subscription-provider";
import { UpgradeModal } from "./upgrade-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PenTool,
  Infinity,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface SignatureUsageBadgeProps {
  variant?: "badge" | "card" | "inline" | "minimal";
  showUpgradeOnLimit?: boolean;
  className?: string;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function SignatureUsageBadge({
  variant = "badge",
  showUpgradeOnLimit = true,
  className,
}: SignatureUsageBadgeProps) {
  const {
    used,
    limit,
    remaining,
    percentage,
    isUnlimited,
    canSign,
    isAtLimit,
    pricePerExtraFormatted,
    loading,
  } = useSignatureQuota();

  const [showUpgrade, setShowUpgrade] = useState(false);

  if (loading) {
    return (
      <div className={cn("animate-pulse bg-slate-200 dark:bg-slate-700 rounded-md h-6 w-24", className)} />
    );
  }

  // Déterminer la couleur selon le pourcentage d'usage
  const getStatusColor = () => {
    if (isUnlimited) return "emerald";
    if (isAtLimit) return "red";
    if (percentage >= 80) return "amber";
    if (percentage >= 50) return "yellow";
    return "emerald";
  };

  const statusColor = getStatusColor();

  // ============================================
  // VARIANTE MINIMAL
  // ============================================
  if (variant === "minimal") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1 text-sm", className)}>
              <PenTool className="w-3.5 h-3.5 text-slate-500" />
              <span className={cn(
                "font-medium",
                isAtLimit && "text-red-600",
                !isAtLimit && percentage >= 80 && "text-amber-600"
              )}>
                {isUnlimited ? (
                  <Infinity className="w-4 h-4 inline" />
                ) : (
                  `${used}/${limit}`
                )}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isUnlimited
                ? "Signatures illimitées"
                : `${remaining} signature${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""} ce mois`}
            </p>
            {!isUnlimited && !canSign && (
              <p className="text-xs text-amber-400 mt-1">
                {pricePerExtraFormatted}/signature supplémentaire
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ============================================
  // VARIANTE BADGE
  // ============================================
  if (variant === "badge") {
    return (
      <>
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer transition-colors",
            statusColor === "emerald" && "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
            statusColor === "amber" && "border-amber-300 text-amber-700 hover:bg-amber-50",
            statusColor === "yellow" && "border-yellow-300 text-yellow-700 hover:bg-yellow-50",
            statusColor === "red" && "border-red-300 text-red-700 hover:bg-red-50",
            className
          )}
          onClick={() => showUpgradeOnLimit && isAtLimit && setShowUpgrade(true)}
        >
          <PenTool className="w-3 h-3 mr-1" />
          {isUnlimited ? (
            <>
              <Infinity className="w-3 h-3 mr-1" />
              Illimité
            </>
          ) : (
            <>
              {used}/{limit}
              {isAtLimit && <AlertTriangle className="w-3 h-3 ml-1" />}
            </>
          )}
        </Badge>

        {showUpgradeOnLimit && (
          <UpgradeModal
            open={showUpgrade}
            onClose={() => setShowUpgrade(false)}
            feature="signatures"
          />
        )}
      </>
    );
  }

  // ============================================
  // VARIANTE INLINE
  // ============================================
  if (variant === "inline") {
    return (
      <>
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border transition-colors",
            isAtLimit
              ? "border-red-200 bg-red-50 dark:bg-red-900/20"
              : percentage >= 80
              ? "border-amber-200 bg-amber-50 dark:bg-amber-900/20"
              : "border-slate-200 bg-slate-50 dark:bg-slate-800",
            className
          )}
        >
          <div className={cn(
            "p-2 rounded-lg",
            statusColor === "emerald" && "bg-emerald-100 text-emerald-600",
            statusColor === "amber" && "bg-amber-100 text-amber-600",
            statusColor === "yellow" && "bg-yellow-100 text-yellow-600",
            statusColor === "red" && "bg-red-100 text-red-600",
          )}>
            <PenTool className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Signatures ce mois
              </span>
              <span className={cn(
                "text-sm font-bold",
                statusColor === "red" && "text-red-600",
                statusColor === "amber" && "text-amber-600",
              )}>
                {isUnlimited ? (
                  <span className="flex items-center gap-1">
                    <Infinity className="w-4 h-4" /> Illimité
                  </span>
                ) : (
                  `${used}/${limit}`
                )}
              </span>
            </div>

            {!isUnlimited && (
              <Progress
                value={percentage}
                className={cn(
                  "h-1.5 mt-2",
                  statusColor === "red" && "[&>div]:bg-red-500",
                  statusColor === "amber" && "[&>div]:bg-amber-500",
                  statusColor === "yellow" && "[&>div]:bg-yellow-500",
                  statusColor === "emerald" && "[&>div]:bg-emerald-500",
                )}
              />
            )}
          </div>

          {isAtLimit && showUpgradeOnLimit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUpgrade(true)}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Upgrader
            </Button>
          )}
        </div>

        {showUpgradeOnLimit && (
          <UpgradeModal
            open={showUpgrade}
            onClose={() => setShowUpgrade(false)}
            feature="signatures"
          />
        )}
      </>
    );
  }

  // ============================================
  // VARIANTE CARD (default)
  // ============================================
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-xl border p-4",
          isAtLimit
            ? "border-red-200 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20"
            : "border-slate-200 bg-white dark:bg-slate-800",
          className
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl",
              statusColor === "emerald" && "bg-emerald-100 text-emerald-600",
              statusColor === "amber" && "bg-amber-100 text-amber-600",
              statusColor === "yellow" && "bg-yellow-100 text-yellow-600",
              statusColor === "red" && "bg-red-100 text-red-600",
            )}>
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Signatures électroniques
              </h3>
              <p className="text-sm text-slate-500">
                {isUnlimited ? "Illimité ce mois" : `${remaining} restante${remaining > 1 ? "s" : ""} ce mois`}
              </p>
            </div>
          </div>

          {isAtLimit && (
            <Badge variant="destructive" className="animate-pulse">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Limite atteinte
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        {!isUnlimited && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-slate-500">Utilisées</span>
              <span className={cn(
                "font-semibold",
                statusColor === "red" && "text-red-600",
                statusColor === "amber" && "text-amber-600",
              )}>
                {used} / {limit}
              </span>
            </div>
            <Progress
              value={percentage}
              className={cn(
                "h-2",
                statusColor === "red" && "[&>div]:bg-red-500",
                statusColor === "amber" && "[&>div]:bg-amber-500",
                statusColor === "yellow" && "[&>div]:bg-yellow-500",
                statusColor === "emerald" && "[&>div]:bg-emerald-500",
              )}
            />
          </div>
        )}

        {/* Infos supplémentaires */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-slate-500">
            <Info className="w-3.5 h-3.5" />
            <span>
              {isUnlimited
                ? "Votre forfait inclut des signatures illimitées"
                : `${pricePerExtraFormatted}/signature au-delà du quota`}
            </span>
          </div>

          {isAtLimit && showUpgradeOnLimit && (
            <Button
              size="sm"
              onClick={() => setShowUpgrade(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white"
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              Upgrader
            </Button>
          )}
        </div>
      </motion.div>

      {showUpgradeOnLimit && (
        <UpgradeModal
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          feature="signatures"
        />
      )}
    </>
  );
}

// ============================================
// COMPOSANT: Indicateur compact pour header/sidebar
// ============================================

export function SignatureQuotaIndicator({ className }: { className?: string }) {
  const { used, limit, isUnlimited, isAtLimit, percentage, loading } = useSignatureQuota();

  if (loading) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-default",
              isAtLimit
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : percentage >= 80
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
              className
            )}
          >
            <PenTool className="w-3 h-3" />
            {isUnlimited ? (
              <Infinity className="w-3.5 h-3.5" />
            ) : (
              <span>{used}/{limit}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="font-medium">Signatures ce mois</p>
          <p className="text-xs text-slate-400">
            {isUnlimited
              ? "Illimité avec votre forfait"
              : isAtLimit
              ? "Quota atteint - signatures payantes"
              : `${limit - used} signature${limit - used > 1 ? "s" : ""} restante${limit - used > 1 ? "s" : ""}`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default SignatureUsageBadge;
