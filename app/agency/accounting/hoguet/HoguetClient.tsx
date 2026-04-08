"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  CreditCard,
  Building2,
  Clock,
  Download,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/utils/format-cents";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HoguetCheckItem {
  key: string;
  label: string;
  description: string;
  passed: boolean;
  detail: string | null;
  icon: React.ElementType;
}

interface TracfinAlert {
  id: string;
  date: string;
  mandantName: string;
  amountCents: number;
  description: string;
  propertyAddress: string;
}

interface HoguetData {
  checks: HoguetCheckItem[];
  tracfinAlerts: TracfinAlert[];
  score: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const defaultChecks: HoguetCheckItem[] = [
  {
    key: "carte_g",
    label: "Carte G valide",
    description: "Carte professionnelle de gestion immobiliere avec numero et date d'expiration",
    passed: false,
    detail: null,
    icon: CreditCard,
  },
  {
    key: "compte_mandant",
    label: "Compte mandant separe",
    description: "Un compte bancaire dedie aux fonds des mandants, distinct du compte de l'agence",
    passed: false,
    detail: null,
    icon: Building2,
  },
  {
    key: "reversements",
    label: "Reversements dans les delais",
    description: "Tous les reversements aux mandants sont effectues dans les delais reglementaires",
    passed: false,
    detail: null,
    icon: Clock,
  },
  {
    key: "crg_a_jour",
    label: "CRG a jour",
    description: "Les Comptes Rendus de Gestion sont generes et envoyes pour tous les mandants",
    passed: false,
    detail: null,
    icon: FileText,
  },
  {
    key: "caisse_garantie",
    label: "Caisse de garantie",
    description: "Attestation de caisse de garantie financiere a jour",
    passed: false,
    detail: null,
    icon: Shield,
  },
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useHoguetCompliance() {
  const { profile } = useAuth();

  return useQuery<any>({
    queryKey: ["agency", "hoguet", profile?.id],
    queryFn: async (): Promise<HoguetData> => {
      if (!profile?.id) {
        return { checks: defaultChecks, tracfinAlerts: [], score: 0, total: 5 };
      }
      try {
        return await apiClient.get<HoguetData>(
          `/agency/accounting/hoguet?agencyId=${profile.id}`
        );
      } catch {
        return { checks: defaultChecks, tracfinAlerts: [], score: 0, total: 5 };
      }
    },
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreBadge({ score, total }: { score: number; total: number }) {
  const ratio = total > 0 ? score / total : 0;
  let color = "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400";
  if (ratio >= 0.8) {
    color = "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400";
  } else if (ratio >= 0.5) {
    color = "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400";
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-lg font-bold",
        color
      )}
    >
      <Shield className="w-5 h-5" />
      {score}/{total} conforme
    </div>
  );
}

function CheckRow({ item }: { item: HoguetCheckItem }) {
  const Icon = item.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4 rounded-xl border transition-colors",
        item.passed
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-red-500/20 bg-red-500/5"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-lg flex-shrink-0",
          item.passed
            ? "bg-emerald-100 dark:bg-emerald-900/30"
            : "bg-red-100 dark:bg-red-900/30"
        )}
      >
        <Icon
          className={cn(
            "w-5 h-5",
            item.passed
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground text-sm">{item.label}</p>
          {item.passed ? (
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        {item.detail && (
          <p className="text-xs text-foreground mt-1 font-mono">{item.detail}</p>
        )}
      </div>
    </div>
  );
}

function TracfinSection({ alerts }: { alerts: TracfinAlert[] }) {
  return (
    <Card className="border-0 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-lg">Alertes TRACFIN</CardTitle>
        </div>
        <CardDescription>
          Mouvements superieurs a 10 000 EUR necessitant une vigilance renforcee
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucune alerte TRACFIN en cours
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">
                      {alert.mandantName}
                    </span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {formatCents(alert.amountCents)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {alert.propertyAddress} — {alert.description}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(alert.date)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HoguetLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-48 rounded-xl" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HoguetClient() {
  const { data, isLoading, error, refetch } = useHoguetCompliance();

  const checks: HoguetCheckItem[] = data?.checks ?? defaultChecks;
  const tracfinAlerts = data?.tracfinAlerts ?? [];
  const score = data?.score ?? 0;
  const total = data?.total ?? 5;

  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Back link */}
        <motion.div variants={itemVariants}>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/agency/accounting">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour a la comptabilite
            </Link>
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
              Conformite loi Hoguet
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Verification automatique des obligations reglementaires
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ScoreBadge score={score} total={total} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                apiClient
                  .post("/agency/accounting/hoguet/report", {})
                  .catch(() => {});
              }}
            >
              <Download className="w-4 h-4 mr-1" />
              Generer rapport conformite
            </Button>
          </div>
        </motion.div>

        {isLoading ? (
          <HoguetLoadingSkeleton />
        ) : error ? (
          <motion.div variants={itemVariants}>
            <Card className="border-0 bg-card/60 backdrop-blur-sm">
              <CardContent className="p-6 text-center space-y-3">
                <p className="text-sm text-destructive">
                  Erreur lors du chargement des donnees de conformite.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Reessayer
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Checklist */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 bg-card/60 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Points de controle</CardTitle>
                  <CardDescription>
                    Verification automatique des obligations legales loi Hoguet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {checks.map((item) => (
                    <CheckRow key={item.key} item={item} />
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* TRACFIN */}
            <motion.div variants={itemVariants}>
              <TracfinSection alerts={tracfinAlerts} />
            </motion.div>
          </>
        )}
      </motion.div>
    </PlanGate>
  );
}
