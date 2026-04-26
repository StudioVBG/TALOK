"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlanGate } from "@/components/subscription/plan-gate";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useEntityStore } from "@/stores/useEntityStore";
import { formatCents } from "@/lib/utils/format-cents";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";

interface AccountAggregate {
  accountNumber: string;
  accountLabel: string;
  totalDebitCents: number;
  totalCreditCents: number;
  balanceCents: number;
  lineCount: number;
}

interface TvaResult {
  entityId: string;
  startDate: string;
  endDate: string;
  revenueAccounts: AccountAggregate[];
  vatCollected: AccountAggregate[];
  vatDeductible: AccountAggregate[];
  totalRevenueCents: number;
  totalVatCollectedCents: number;
  totalVatDeductibleCents: number;
  vatToPayCents: number;
  averageRatePct: number | null;
  recommendation: string;
}

interface TvaResponse {
  success: boolean;
  data: TvaResult;
}

type Period = "month" | "quarter" | "year" | "custom";

function getPeriodDates(period: Period, ref: Date = new Date()): {
  start: string;
  end: string;
  label: string;
} {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  if (period === "month") {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
      label: start.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      }),
    };
  }
  if (period === "quarter") {
    const quarter = Math.floor(m / 3);
    const start = new Date(y, quarter * 3, 1);
    const end = new Date(y, quarter * 3 + 3, 0);
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
      label: `T${quarter + 1} ${y}`,
    };
  }
  // year
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
    label: `Année ${y}`,
  };
}

export default function TvaPageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <Content />
    </PlanGate>
  );
}

function Content() {
  const { profile } = useAuth();
  const { activeEntityId } = useEntityStore();
  const entityId =
    activeEntityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    undefined;

  const [period, setPeriod] = useState<Period>("quarter");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { start, end, label } = useMemo(() => {
    if (period === "custom" && customStart && customEnd) {
      return { start: customStart, end: customEnd, label: "Personnalisé" };
    }
    return getPeriodDates(period === "custom" ? "quarter" : period);
  }, [period, customStart, customEnd]);

  const tvaQuery = useQuery({
    queryKey: ["accounting", "tva", entityId, start, end],
    queryFn: async (): Promise<TvaResult | null> => {
      if (!entityId) return null;
      const params = new URLSearchParams({ entityId, start, end });
      const res = await apiClient.get<TvaResponse>(
        `/accounting/declarations/tva?${params.toString()}`,
      );
      return res?.data ?? null;
    },
    enabled: !!entityId,
    staleTime: 60 * 1000,
  });

  if (!entityId) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Sélectionnez une entité comptable.
          </p>
        </div>
      </div>
    );
  }

  const data = tvaQuery.data;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Déclaration TVA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calcul de la TVA collectée, déductible et nette à reverser sur la
          période. Source : écritures validées sur les comptes 706, 445710,
          445660.
        </p>
      </div>

      {/* Period selector */}
      <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">
          Période :
        </span>
        <PeriodButton
          active={period === "month"}
          onClick={() => setPeriod("month")}
        >
          Mois en cours
        </PeriodButton>
        <PeriodButton
          active={period === "quarter"}
          onClick={() => setPeriod("quarter")}
        >
          Trimestre en cours
        </PeriodButton>
        <PeriodButton
          active={period === "year"}
          onClick={() => setPeriod("year")}
        >
          Année en cours
        </PeriodButton>
        <PeriodButton
          active={period === "custom"}
          onClick={() => setPeriod("custom")}
        >
          Personnalisée
        </PeriodButton>
        {period === "custom" && (
          <>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
            <span className="text-xs text-muted-foreground">à</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
          </>
        )}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {label} · {start} → {end}
        </span>
        {tvaQuery.isFetching && !tvaQuery.isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {tvaQuery.isLoading || !data ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats globales */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <StatCard
              label="CA HT"
              value={formatCents(data.totalRevenueCents)}
              tone="neutral"
            />
            <StatCard
              label="TVA collectée (445710)"
              value={formatCents(data.totalVatCollectedCents)}
              tone="positive"
            />
            <StatCard
              label="TVA déductible (445660)"
              value={formatCents(data.totalVatDeductibleCents)}
              tone="negative"
            />
            <StatCard
              label={data.vatToPayCents >= 0 ? "TVA à reverser" : "Crédit TVA"}
              value={formatCents(Math.abs(data.vatToPayCents))}
              tone={data.vatToPayCents > 0 ? "negative" : "positive"}
            />
          </div>

          {/* Recommandation */}
          <RecommendationBox
            text={data.recommendation}
            netCents={data.vatToPayCents}
            hasActivity={
              data.totalVatCollectedCents > 0 || data.totalVatDeductibleCents > 0
            }
          />

          {/* Détail par compte */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <AccountSection
              title="Chiffre d'affaires HT (706xxx)"
              accounts={data.revenueAccounts}
              valueGetter={(a) => a.totalCreditCents - a.totalDebitCents}
              tone="neutral"
            />
            <AccountSection
              title="TVA collectée (445710)"
              accounts={data.vatCollected}
              valueGetter={(a) => a.totalCreditCents - a.totalDebitCents}
              tone="positive"
            />
            <AccountSection
              title="TVA déductible (445660)"
              accounts={data.vatDeductible}
              valueGetter={(a) => a.totalDebitCents - a.totalCreditCents}
              tone="negative"
            />
          </div>

          {/* Lien vers impots.gouv.fr */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Déposer la déclaration
            </h2>
            <p className="text-xs text-muted-foreground">
              Talok ne génère pas encore le formulaire CA3 PDF officiel. Reporte
              les chiffres ci-dessus dans ta déclaration sur impots.gouv.fr :
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
              <li>
                <strong>Cadre A — Opérations imposables</strong>, ligne 01 (base
                HT) : {formatCents(data.totalRevenueCents)}
              </li>
              <li>
                <strong>Cadre B — TVA brute</strong>, lignes 08 (taux 20%) /
                etc. selon ventilation : {formatCents(data.totalVatCollectedCents)}
              </li>
              <li>
                <strong>Cadre C — TVA déductible</strong>, ligne 19/20 :{" "}
                {formatCents(data.totalVatDeductibleCents)}
              </li>
              <li>
                <strong>Cadre D — TVA nette à payer</strong>, ligne 28 :{" "}
                {formatCents(Math.max(0, data.vatToPayCents))}
              </li>
            </ul>
            <a
              href="https://www.impots.gouv.fr/professionnel/teleprocedures-tva"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
            >
              Accéder à impots.gouv.fr <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function PeriodButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-foreground hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const colorClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-foreground";
  return (
    <div className="bg-card rounded-xl border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}

function RecommendationBox({
  text,
  netCents,
  hasActivity,
}: {
  text: string;
  netCents: number;
  hasActivity: boolean;
}) {
  if (!hasActivity) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <span className="text-foreground">{text}</span>
      </div>
    );
  }
  const isPositive = netCents <= 0;
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        isPositive
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      }`}
    >
      {isPositive ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      )}
      <span className="text-foreground">{text}</span>
    </div>
  );
}

function AccountSection({
  title,
  accounts,
  valueGetter,
  tone,
}: {
  title: string;
  accounts: AccountAggregate[];
  valueGetter: (a: AccountAggregate) => number;
  tone: "positive" | "negative" | "neutral";
}) {
  const colorClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-foreground";

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <h2 className="text-sm font-semibold text-foreground px-4 py-2.5 border-b border-border bg-muted/30">
        {title}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          ({accounts.length})
        </span>
      </h2>
      {accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground px-4 py-3">
          Aucun mouvement sur cette période.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {accounts.map((a) => (
            <li
              key={a.accountNumber}
              className="flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/30"
            >
              <div className="min-w-0">
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {a.accountNumber}
                </span>
                <span className="text-foreground">{a.accountLabel}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({a.lineCount} ligne{a.lineCount > 1 ? "s" : ""})
                </span>
              </div>
              <span className={`font-medium whitespace-nowrap ${colorClass}`}>
                {formatCents(Math.abs(valueGetter(a)))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { TvaResult };
