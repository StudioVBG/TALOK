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
  Home,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface AccountRow {
  accountNumber: string;
  accountLabel: string;
  classChar: string;
  totalDebitCents: number;
  totalCreditCents: number;
  balanceCents: number;
}

interface PropertyPnl {
  propertyId: string;
  propertyAddress: string | null;
  propertyType: string | null;
  surfaceM2: number | null;
  revenueCents: number;
  expensesCents: number;
  netResultCents: number;
  yieldPerSqmEuros: number | null;
  accounts: AccountRow[];
}

interface PnlResponse {
  success: boolean;
  data: { properties: PropertyPnl[] };
}

interface ExerciseRow {
  id: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
}

interface ExercisesResponse {
  success?: boolean;
  data?: { exercises: ExerciseRow[] };
}

export default function RendementPageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <RendementContent />
    </PlanGate>
  );
}

function RendementContent() {
  const { profile } = useAuth();
  const { activeEntityId } = useEntityStore();
  const entityId =
    activeEntityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    undefined;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const exerciseQuery = useQuery({
    queryKey: ["accounting", "current-exercise", entityId],
    queryFn: async (): Promise<ExerciseRow | null> => {
      if (!entityId) return null;
      const res = await apiClient.get<ExercisesResponse | ExerciseRow[]>(
        `/accounting/exercises?entityId=${entityId}`,
      );
      const list = Array.isArray(res) ? res : res?.data?.exercises ?? [];
      return list.find((e) => e.status === "open") ?? list[0] ?? null;
    },
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000,
  });

  const exercise = exerciseQuery.data ?? null;

  const pnlQuery = useQuery({
    queryKey: ["accounting", "pnl-by-property", entityId, exercise?.id],
    queryFn: async (): Promise<PropertyPnl[]> => {
      if (!entityId) return [];
      const params = new URLSearchParams({ entityId });
      if (exercise?.id) params.set("exerciseId", exercise.id);
      const res = await apiClient.get<PnlResponse>(
        `/accounting/pnl-by-property?${params.toString()}`,
      );
      return res?.data?.properties ?? [];
    },
    enabled: !!entityId,
    staleTime: 60 * 1000,
  });

  const properties = pnlQuery.data ?? [];

  const totals = useMemo(() => {
    let revenue = 0;
    let expenses = 0;
    let net = 0;
    for (const p of properties) {
      revenue += p.revenueCents;
      expenses += p.expensesCents;
      net += p.netResultCents;
    }
    return { revenue, expenses, net };
  }, [properties]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!entityId) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Sélectionnez une entité comptable pour afficher le rendement par bien.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Rendement par bien
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            P&L analytique calculé sur les écritures validées
            {exercise && ` (exercice ${exercise.startDate} → ${exercise.endDate})`}
          </p>
        </div>
        {pnlQuery.isFetching && !pnlQuery.isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Stats globales */}
      {!pnlQuery.isLoading && properties.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Revenus totaux"
            value={formatCents(totals.revenue)}
            tone="positive"
            icon={TrendingUp}
          />
          <StatCard
            label="Charges totales"
            value={formatCents(totals.expenses)}
            tone="negative"
            icon={TrendingDown}
          />
          <StatCard
            label="Résultat net"
            value={formatCents(totals.net)}
            tone={totals.net >= 0 ? "positive" : "negative"}
            icon={Home}
          />
        </div>
      )}

      {pnlQuery.isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {properties.map((p) => (
            <PropertyCard
              key={p.propertyId}
              property={p}
              isOpen={expanded.has(p.propertyId)}
              onToggle={() => toggle(p.propertyId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  icon: typeof Home;
}) {
  const colorClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-foreground";
  return (
    <div className="bg-card rounded-xl border border-border px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <p className={`text-xl font-semibold mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}

function PropertyCard({
  property,
  isOpen,
  onToggle,
}: {
  property: PropertyPnl;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isPositive = property.netResultCents >= 0;

  return (
    <section className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {property.propertyAddress ?? `Bien ${property.propertyId.slice(0, 8)}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {property.propertyType ?? "Bien"}
              {property.surfaceM2 ? ` · ${property.surfaceM2} m²` : ""}
              {" · "}
              {property.accounts.length} compte{property.accounts.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-xs">
          <span className="text-emerald-600">
            <span className="text-muted-foreground mr-1">Revenus :</span>
            <strong className="font-medium">{formatCents(property.revenueCents)}</strong>
          </span>
          <span className="text-rose-600">
            <span className="text-muted-foreground mr-1">Charges :</span>
            <strong className="font-medium">{formatCents(property.expensesCents)}</strong>
          </span>
          <span
            className={`font-semibold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}
          >
            {formatCents(property.netResultCents)}
          </span>
          {property.yieldPerSqmEuros !== null && (
            <span className="text-muted-foreground">
              ({property.yieldPerSqmEuros.toFixed(2)} €/m²)
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground bg-muted/10 border-b border-border">
                <th className="text-left font-medium px-4 py-2">N° compte</th>
                <th className="text-left font-medium px-4 py-2">Libellé</th>
                <th className="text-right font-medium px-4 py-2">Débit</th>
                <th className="text-right font-medium px-4 py-2">Crédit</th>
                <th className="text-right font-medium px-4 py-2">Solde</th>
              </tr>
            </thead>
            <tbody>
              {property.accounts.map((a) => (
                <tr
                  key={a.accountNumber}
                  className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-2 font-mono text-xs text-foreground whitespace-nowrap">
                    {a.accountNumber}
                  </td>
                  <td className="px-4 py-2 text-foreground">{a.accountLabel}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {a.totalDebitCents > 0 ? formatCents(a.totalDebitCents) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {a.totalCreditCents > 0 ? formatCents(a.totalCreditCents) : "—"}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-medium whitespace-nowrap ${
                      a.classChar === "7"
                        ? "text-emerald-600"
                        : a.classChar === "6"
                          ? "text-rose-600"
                          : "text-foreground"
                    }`}
                  >
                    {formatCents(Math.abs(a.balanceCents))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Home className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <h3 className="text-base font-medium">Aucune donnée analytique pour l'instant</h3>
        <p className="text-sm text-muted-foreground">
          Les écritures comptables doivent être validées et porter un{" "}
          <code className="font-mono text-xs">property_id</code> pour apparaître
          ici. Les nouveaux loyers, dépôts et régularisations sont automatiquement
          ventilés. Pour les écritures historiques, applique la migration de
          back-fill <code className="font-mono text-xs">20260427210000</code>.
        </p>
      </div>
    </div>
  );
}
