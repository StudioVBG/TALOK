"use client";

/**
 * ScoringDashboard - Dashboard complet d'analyse de solvabilité
 * Design SOTA 2025 avec layout moderne et animations orchestrées
 * SOTA 2026: Feature scoring_tenant requiert Confort+
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PlanGate } from "@/components/subscription";
import {
  User,
  Building2,
  FileText,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Share2,
  Download,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "./ScoreGauge";
import { ScoreFactorCard } from "./ScoreFactorCard";
import { ScoreDecisionPanel } from "./ScoreDecisionPanel";
import type { SolvabilityScore } from "@/lib/scoring/types";

interface TenantInfo {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
}

interface PropertyInfo {
  address: string;
  rent: number;
  charges: number;
  type?: string;
}

interface ScoringDashboardProps {
  applicationId: string;
  tenantInfo: TenantInfo;
  propertyInfo: PropertyInfo;
  initialScore?: SolvabilityScore | null;
  onAccept?: () => Promise<void>;
  onReject?: (reason: string) => Promise<void>;
  onRequestMore?: () => void;
  onBack?: () => void;
}

// Stagger animation pour les cartes
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function ScoringDashboard({
  applicationId,
  tenantInfo,
  propertyInfo,
  initialScore,
  onAccept,
  onReject,
  onRequestMore,
  onBack,
}: ScoringDashboardProps) {
  const [score, setScore] = useState<SolvabilityScore | null>(initialScore || null);
  const [isLoading, setIsLoading] = useState(!initialScore);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Charger le score initial
  useEffect(() => {
    if (!initialScore) {
      calculateScore();
    }
  }, [applicationId, initialScore]);

  const calculateScore = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}/score`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setScore(data.score);
      }
    } catch (error) {
      console.error("Erreur calcul score:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshScore = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}/score`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setScore(data.score);
      }
    } catch (error) {
      console.error("Erreur refresh score:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-12 h-12 text-primary mx-auto" />
          </motion.div>
          <p className="text-lg text-muted-foreground">
            Analyse du dossier en cours...
          </p>
          <p className="text-sm text-muted-foreground/70">
            Calcul du score de solvabilité
          </p>
        </motion.div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">
            Impossible de calculer le score
          </p>
          <Button onClick={calculateScore}>Réessayer</Button>
        </div>
      </div>
    );
  }

  return (
    <PlanGate feature="scoring_tenant" mode="blur">
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="rounded-full"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Analyse de solvabilité
                </h1>
                <p className="text-sm text-muted-foreground">
                  Dossier #{applicationId.slice(0, 8)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshScore}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw
                  className={cn("w-4 h-4", isRefreshing && "animate-spin")}
                />
                Recalculer
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Exporter
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Share2 className="w-4 h-4" />
                Partager
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Left column - Score & Infos */}
          <motion.div variants={itemVariants} className="lg:col-span-1 space-y-6">
            {/* Score gauge */}
            <div className="bg-card/50 backdrop-blur-sm rounded-3xl border border-border/50 p-8 flex flex-col items-center">
              <ScoreGauge score={score.totalScore} size="xl" />
            </div>

            {/* Tenant info card */}
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {tenantInfo.firstName} {tenantInfo.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {tenantInfo.email}
                  </p>
                </div>
              </div>
              {tenantInfo.phone && (
                <p className="text-sm text-muted-foreground">
                  📱 {tenantInfo.phone}
                </p>
              )}
            </div>

            {/* Property info card */}
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    Logement concerné
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {propertyInfo.address}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground">Loyer</p>
                  <p className="text-lg font-bold text-foreground">
                    {propertyInfo.rent}€
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground">Charges</p>
                  <p className="text-lg font-bold text-foreground">
                    {propertyInfo.charges}€
                  </p>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Documents</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(score.factors).map(([key, factor]) => {
                  if (key === "documentCompleteness") {
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          Complétude
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            factor.status === "pass"
                              ? "text-emerald-500"
                              : factor.status === "warning"
                              ? "text-amber-500"
                              : "text-red-500"
                          )}
                        >
                          {factor.score}%
                        </span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </motion.div>

          {/* Right column - Factors & Decision */}
          <motion.div variants={itemVariants} className="lg:col-span-2 space-y-8">
            {/* Score factors */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Détail des facteurs
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(score.factors).map(([key, factor], index) => (
                  <ScoreFactorCard
                    key={key}
                    factor={factor}
                    index={index}
                  />
                ))}
              </div>
            </div>

            {/* Decision panel */}
            <div className="bg-card/50 backdrop-blur-sm rounded-3xl border border-border/50 p-8">
              <ScoreDecisionPanel
                score={score}
                onAccept={onAccept}
                onReject={onReject}
                onRequestMore={onRequestMore}
              />
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
    </PlanGate>
  );
}

