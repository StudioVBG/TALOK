"use client";

import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useCoproSites } from "@/lib/hooks/use-copro-lots";
import { useSyndicDashboard } from "@/lib/hooks/use-syndic-dashboard";
import { formatCents } from "@/lib/utils/format-cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  Hammer,
  TrendingUp,
  Wallet,
  Info,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export default function FondsTravauxClient() {
  return (
    <PlanGate feature="copro_module" mode="blur">
      <FondsTravauxContent />
    </PlanGate>
  );
}

function FondsTravauxContent() {
  const { data: sites } = useCoproSites();
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const activeSiteId = selectedSiteId || sites?.[0]?.id || "";

  const { worksFund, kpis, isLoading } = useSyndicDashboard(activeSiteId);

  if (isLoading) {
    return <FondsTravauxLoadingSkeleton />;
  }

  const minRate = 2.5;
  const isCompliant = (worksFund?.rate_pct ?? 0) >= minRate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Link
            href="/syndic/accounting"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
              Fonds de travaux
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cotisation obligatoire loi ALUR
            </p>
          </div>
        </div>

        {sites && sites.length > 1 && (
          <Select value={activeSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-full sm:w-64">
              <Building2 className="w-4 h-4 mr-2 text-cyan-600" />
              <SelectValue placeholder="Selectionner une copropriete" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Compliance alert */}
      <Card
        className={
          isCompliant
            ? "border-emerald-200 dark:border-emerald-800"
            : "border-amber-200 dark:border-amber-800"
        }
      >
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div
              className={`shrink-0 p-2 rounded-lg ${
                isCompliant
                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : "bg-amber-100 dark:bg-amber-900/40"
              }`}
            >
              {isCompliant ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {isCompliant
                  ? "Conforme a la loi ALUR"
                  : "Attention : taux inferieur au minimum legal"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                La loi ALUR impose une cotisation minimale de 2,5% du budget
                previsionnel pour les coproprietes de plus de 10 lots. Le taux
                actuel est de {worksFund?.rate_pct ?? 0}%.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Solde du fonds"
          value={formatCents(worksFund?.balance_cents ?? 0)}
          icon={<Wallet className="w-5 h-5" />}
          color="cyan"
        />
        <KpiCard
          title="Taux de cotisation"
          value={`${worksFund?.rate_pct ?? 0}%`}
          icon={<Hammer className="w-5 h-5" />}
          color="blue"
          subtitle={`Minimum legal : ${minRate}%`}
        />
        <KpiCard
          title="Evolution"
          value={`${(worksFund?.evolution_cents ?? 0) >= 0 ? "+" : ""}${formatCents(worksFund?.evolution_cents ?? 0)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color={(worksFund?.evolution_cents ?? 0) >= 0 ? "green" : "red"}
          subtitle="depuis le dernier exercice"
        />
      </div>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-600" />
            A propos du fonds de travaux
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">
                Obligation legale
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Cotisation annuelle obligatoire (loi ALUR du 24 mars 2014)
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Minimum 2,5% du budget previsionnel pour les coproprietes de
                  plus de 10 lots
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Fonds attache aux lots et non remboursable en cas de vente
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">
                Utilisation
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Finance les travaux prescrits par la loi ou le reglement
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Travaux de conservation ou d&apos;amelioration de l&apos;immeuble
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5" />
                  Decision d&apos;utilisation votee en AG (majorite art. 25)
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: "cyan" | "blue" | "green" | "red";
  subtitle?: string;
}) {
  const colorMap = {
    cyan: {
      bg: "bg-cyan-100 dark:bg-cyan-900/40",
      text: "text-cyan-600 dark:text-cyan-400",
      gradient:
        "from-cyan-50 to-cyan-100/50 dark:from-cyan-900/20 dark:to-cyan-800/10",
    },
    blue: {
      bg: "bg-blue-100 dark:bg-blue-900/40",
      text: "text-blue-600 dark:text-blue-400",
      gradient:
        "from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10",
    },
    green: {
      bg: "bg-emerald-100 dark:bg-emerald-900/40",
      text: "text-emerald-600 dark:text-emerald-400",
      gradient:
        "from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10",
    },
    red: {
      bg: "bg-red-100 dark:bg-red-900/40",
      text: "text-red-600 dark:text-red-400",
      gradient:
        "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10",
    },
  };
  const colors = colorMap[color];

  return (
    <Card className="relative overflow-hidden">
      <div
        className={`absolute inset-0 bg-gradient-to-br opacity-50 ${colors.gradient}`}
      />
      <CardContent className="relative pt-4 sm:pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-lg sm:text-2xl font-bold tracking-tight truncate text-foreground">
              {value}
            </p>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className={`shrink-0 p-2 sm:p-3 rounded-xl ${colors.bg} ${colors.text}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FondsTravauxLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-52" />
      <div className="h-20 bg-muted rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
