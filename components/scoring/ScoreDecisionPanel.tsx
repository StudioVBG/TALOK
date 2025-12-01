"use client";

/**
 * ScoreDecisionPanel - Panel de décision propriétaire
 * Design SOTA 2025 avec animations et feedback haptique
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/design-system/design-tokens";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Shield,
  AlertTriangle,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { SolvabilityScore, RiskItem } from "@/lib/scoring/types";

interface ScoreDecisionPanelProps {
  score: SolvabilityScore;
  onAccept?: () => Promise<void>;
  onReject?: (reason: string) => Promise<void>;
  onRequestMore?: () => void;
  isLoading?: boolean;
}

const recommendationConfig = {
  accept: {
    icon: CheckCircle2,
    title: "Dossier favorable",
    subtitle: "Vous pouvez accepter ce locataire en confiance",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    buttonVariant: "default" as const,
    buttonText: "Accepter le dossier",
  },
  review: {
    icon: Clock,
    title: "Dossier à étudier",
    subtitle: "Quelques points méritent votre attention",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    buttonVariant: "outline" as const,
    buttonText: "Demander des garanties",
  },
  reject: {
    icon: XCircle,
    title: "Dossier risqué",
    subtitle: "Ce dossier présente des risques importants",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    buttonVariant: "destructive" as const,
    buttonText: "Refuser le dossier",
  },
};

function RiskCard({ risk }: { risk: RiskItem }) {
  const severityConfig = {
    low: { color: "text-blue-500", bg: "bg-blue-500/10" },
    medium: { color: "text-amber-500", bg: "bg-amber-500/10" },
    high: { color: "text-orange-500", bg: "bg-orange-500/10" },
    critical: { color: "text-red-500", bg: "bg-red-500/10" },
  };

  const config = severityConfig[risk.severity];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "p-4 rounded-xl border",
        config.bg,
        "border-border/50"
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn("w-5 h-5 mt-0.5", config.color)} />
        <div className="flex-1">
          <h4 className="font-medium text-foreground">{risk.title}</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {risk.description}
          </p>
          {risk.mitigation && (
            <p className="text-sm text-primary mt-2 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {risk.mitigation}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StrengthBadge({ strength }: { strength: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
    >
      <Sparkles className="w-3 h-3 text-emerald-500" />
      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        {strength}
      </span>
    </motion.div>
  );
}

export function ScoreDecisionPanel({
  score,
  onAccept,
  onReject,
  onRequestMore,
  isLoading = false,
}: ScoreDecisionPanelProps) {
  const [showRisks, setShowRisks] = useState(false);
  const [showStrengths, setShowStrengths] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const config = recommendationConfig[score.recommendation];
  const RecommendationIcon = config.icon;

  const handleAccept = async () => {
    if (!onAccept) return;
    triggerHaptic("success");
    setActionLoading("accept");
    try {
      await onAccept();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    triggerHaptic("error");
    setActionLoading("reject");
    try {
      await onReject("Dossier refusé suite à l'analyse de solvabilité");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Recommendation header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 p-6",
          config.bgColor,
          config.borderColor
        )}
      >
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent" />
        
        <div className="relative flex items-center gap-4">
          <motion.div
            className={cn("p-3 rounded-xl", config.bgColor)}
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
            }}
          >
            <RecommendationIcon className={cn("w-8 h-8", config.color)} />
          </motion.div>
          
          <div className="flex-1">
            <h2 className={cn("text-xl font-bold", config.color)}>
              {config.title}
            </h2>
            <p className="text-muted-foreground mt-1">
              {config.subtitle}
            </p>
          </div>

          {/* GLI badge */}
          {score.metrics.isGLIEligible && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
            >
              <span className="text-xs font-semibold text-primary">
                Éligible GLI ✓
              </span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-card border border-border/50 text-center"
        >
          <p className="text-2xl font-bold text-foreground">
            {score.metrics.effortRate}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Taux d'effort
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-xl bg-card border border-border/50 text-center"
        >
          <p className="text-2xl font-bold text-foreground">
            {score.metrics.requiredIncomeRatio}x
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ratio revenus/loyer
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-xl bg-card border border-border/50 text-center"
        >
          <p className="text-2xl font-bold text-foreground">
            {score.metrics.totalMonthlyRent}€
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Loyer total
          </p>
        </motion.div>
      </div>

      {/* Strengths */}
      {score.strengths.length > 0 && (
        <Collapsible open={showStrengths} onOpenChange={setShowStrengths}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-emerald-500" />
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Points forts ({score.strengths.length})
              </span>
            </div>
            <ChevronDown
              className={cn(
                "w-5 h-5 text-emerald-500 transition-transform",
                showStrengths && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="flex flex-wrap gap-2">
              {score.strengths.map((strength, i) => (
                <StrengthBadge key={i} strength={strength} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Risks */}
      {score.risks.length > 0 && (
        <Collapsible open={showRisks} onOpenChange={setShowRisks}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-xl bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-colors">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="font-semibold text-red-600 dark:text-red-400">
                Risques identifiés ({score.risks.length})
              </span>
            </div>
            <ChevronDown
              className={cn(
                "w-5 h-5 text-red-500 transition-transform",
                showRisks && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            {score.risks.map((risk) => (
              <RiskCard key={risk.id} risk={risk} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Recommendations */}
      {score.recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="p-4 rounded-xl bg-primary/5 border border-primary/20"
        >
          <h3 className="font-semibold text-primary flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4" />
            Recommandations
          </h3>
          <ul className="space-y-2">
            {score.recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-primary mt-0.5">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col sm:flex-row gap-3 pt-4"
      >
        <Button
          size="lg"
          className={cn(
            "flex-1 h-14 text-base font-semibold",
            score.recommendation === "accept" && "bg-emerald-600 hover:bg-emerald-700"
          )}
          onClick={handleAccept}
          disabled={isLoading || actionLoading !== null}
        >
          {actionLoading === "accept" ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="w-5 h-5 mr-2" />
          )}
          Accepter le dossier
        </Button>

        {score.recommendation === "review" && (
          <Button
            size="lg"
            variant="outline"
            className="flex-1 h-14 text-base font-semibold"
            onClick={onRequestMore}
            disabled={isLoading || actionLoading !== null}
          >
            <Clock className="w-5 h-5 mr-2" />
            Demander plus d'infos
          </Button>
        )}

        <Button
          size="lg"
          variant="outline"
          className="flex-1 h-14 text-base font-semibold text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          onClick={handleReject}
          disabled={isLoading || actionLoading !== null}
        >
          {actionLoading === "reject" ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <XCircle className="w-5 h-5 mr-2" />
          )}
          Refuser
        </Button>
      </motion.div>

      {/* Timestamp */}
      <p className="text-xs text-center text-muted-foreground">
        Score calculé le{" "}
        {new Date(score.calculatedAt).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {" • "}
        Version {score.version}
      </p>
    </div>
  );
}

