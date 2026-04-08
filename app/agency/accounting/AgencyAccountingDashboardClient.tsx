"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Euro,
  TrendingUp,
  TrendingDown,
  Users,
  Receipt,
  Building2,
  ArrowRight,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/utils/format-cents";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useAgencyDashboard, type MandantCard, type MandantStatus, type AgencyRecentEntry } from "@/lib/hooks/use-agency-dashboard";

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type TabKey = "ma_comptabilite" | "comptes_mandants";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ma_comptabilite", label: "Ma comptabilite" },
  { key: "comptes_mandants", label: "Comptes mandants" },
];

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

const statusConfig: Record<MandantStatus, { label: string; color: string }> = {
  a_jour: {
    label: "A jour",
    color: "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  crg_en_retard: {
    label: "CRG en retard",
    color: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400",
  },
  reversement_en_retard: {
    label: "Reversement en retard",
    color: "border-red-500 text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400",
  },
};

const sourceLabels: Record<AgencyRecentEntry["source"], string> = {
  manual: "Manuel",
  stripe: "Stripe",
  ocr: "OCR",
  import: "Import",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KPICard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card className="border-0 bg-card/60 backdrop-blur-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("p-3 rounded-xl", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-foreground mt-0.5">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MandantCardComponent({ mandant }: { mandant: MandantCard }) {
  const status = statusConfig[mandant.status];
  return (
    <Link href={`/agency/accounting/mandants/${mandant.id}`}>
      <Card className="border-0 bg-card/60 backdrop-blur-sm hover:shadow-lg transition-all duration-200 hover:scale-[1.01] cursor-pointer">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1B2A6B] flex items-center justify-center text-white text-sm font-semibold">
                {mandant.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-foreground">{mandant.name}</p>
                <p className="text-xs text-muted-foreground">
                  Ref. {mandant.mandateRef}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={cn("text-xs", status.color)}>
              {status.label}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Biens</p>
              <p className="font-medium text-foreground">{mandant.nbProperties}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Commission</p>
              <p className="font-medium text-foreground">{mandant.commissionRate}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Loyers collectes</p>
              <p className="font-medium text-foreground">
                {formatCents(mandant.loyersCollectesCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Solde a reverser</p>
              <p className="font-medium text-foreground">
                {formatCents(mandant.soldeAReverserCents)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Dernier CRG : {formatDate(mandant.dernierCrgDate)}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function RecentAgencyEntriesTable({ entries }: { entries: AgencyRecentEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucune ecriture recente
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Libelle</th>
              <th className="text-left px-4 py-2 font-medium">Journal</th>
              <th className="text-right px-4 py-2 font-medium">Debit</th>
              <th className="text-right px-4 py-2 font-medium">Credit</th>
              <th className="text-center px-4 py-2 font-medium">Source</th>
              <th className="text-center px-4 py-2 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDate(entry.entryDate)}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {entry.label}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {entry.journalCode}
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                  {entry.totalDebitCents > 0 ? formatCents(entry.totalDebitCents) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                  {entry.totalCreditCents > 0 ? formatCents(entry.totalCreditCents) : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-400 border-slate-500/20">
                    {sourceLabels[entry.source]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={cn(
                      "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border",
                      entry.isValidated
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    )}
                  >
                    {entry.isValidated ? "Valide" : "Brouillon"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-border">
        {entries.map((entry) => (
          <div key={entry.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {entry.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(entry.entryDate)} - {entry.journalCode}
                </p>
              </div>
              <p className="text-sm font-medium text-foreground whitespace-nowrap">
                {entry.totalDebitCents > 0
                  ? formatCents(entry.totalDebitCents)
                  : formatCents(entry.totalCreditCents)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AgencyAccountingDashboardClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("ma_comptabilite");
  const { kpis, mandants, recentEntries, isLoading, error } = useAgencyDashboard();

  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
              Comptabilite Agence
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Tableau de bord comptable et suivi des mandants
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/agency/accounting/crg">
                <Receipt className="w-4 h-4 mr-2" />
                Gestion CRG
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/agency/accounting/hoguet">
                <CheckCircle className="w-4 h-4 mr-2" />
                Conformite Hoguet
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants}>
          <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  activeTab === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {isLoading ? (
          <DashboardSkeleton />
        ) : error ? (
          <Card className="border-0 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-destructive">
                Erreur lors du chargement des donnees comptables. Veuillez
                reessayer.
              </p>
            </CardContent>
          </Card>
        ) : activeTab === "ma_comptabilite" ? (
          <>
            {/* KPI Row */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <KPICard
                title="CA Honoraires"
                value={formatCents(kpis?.caHonorairesCents ?? 0)}
                icon={Euro}
                color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                subtitle="Compte 706100"
              />
              <KPICard
                title="Charges agence"
                value={formatCents(kpis?.chargesAgenceCents ?? 0)}
                icon={TrendingDown}
                color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              />
              <KPICard
                title="Resultat"
                value={formatCents(kpis?.resultatCents ?? 0)}
                icon={TrendingUp}
                color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              />
              <KPICard
                title="Mandants actifs"
                value={String(kpis?.nbMandantsActifs ?? 0)}
                icon={Users}
                color="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
              />
            </motion.div>

            {/* Recent entries */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 bg-card/60 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">Ecritures recentes</CardTitle>
                    <CardDescription>
                      Dernieres ecritures comptables de l'agence
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <RecentAgencyEntriesTable entries={recentEntries} />
                </CardContent>
              </Card>
            </motion.div>
          </>
        ) : (
          /* Comptes mandants tab */
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {mandants.length > 0 ? (
              mandants.map((m) => (
                <MandantCardComponent key={m.id} mandant={m} />
              ))
            ) : (
              <div className="col-span-full text-center py-16 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucun mandant enregistre</p>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </PlanGate>
  );
}
