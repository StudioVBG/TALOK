/**
 * Widgets KPI complémentaires du dashboard comptable propriétaire.
 *
 * - Top 3 biens par revenu sur l'exercice courant.
 * - Comparaison YoY (revenus, charges, résultat) avec indicateur de variation.
 * - Charges récupérées (708xxx) — TEOM, refacturations.
 *
 * Données chargées via useAccountingWidgets (un seul round-trip API).
 * Affiche un skeleton pendant le chargement et se masque silencieusement
 * si l'API renvoie une erreur ou des données vides (le dashboard reste
 * fonctionnel sans ces widgets).
 */

"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownRight,
  Home,
  TrendingUp,
  Receipt,
  Loader2,
} from "lucide-react";
import { useAccountingWidgets } from "@/lib/hooks/use-accounting-widgets";
import { formatCents } from "@/lib/utils/format-cents";

interface AccountingKpiWidgetsProps {
  entityId: string | undefined;
  exerciseId: string | undefined;
}

export function AccountingKpiWidgets({
  entityId,
  exerciseId,
}: AccountingKpiWidgetsProps) {
  const { data, isLoading, isError } = useAccountingWidgets({
    entityId,
    exerciseId,
  });

  if (!entityId || !exerciseId) return null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-card rounded-xl border border-border p-4 h-44 flex items-center justify-center"
          >
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) return null;

  const { topProperties, yoy, recoverableChargesCents } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Top biens par revenu ────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Top biens par revenu
          </h3>
        </div>
        {topProperties.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun bien avec axe analytique sur cet exercice. Les écritures
            futures seront ventilées automatiquement.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {topProperties.map((p, idx) => (
              <li key={p.propertyId} className="flex items-start gap-3">
                <span className="text-xs font-mono text-muted-foreground mt-0.5">
                  #{idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {p.propertyAddress ?? "Bien sans adresse"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatCents(p.revenueCents)} revenus</span>
                    <span>·</span>
                    <span
                      className={
                        p.netResultCents >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }
                    >
                      {p.netResultCents >= 0 ? "+" : ""}
                      {formatCents(p.netResultCents)} net
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/owner/accounting/rendement"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Voir le rendement complet <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      {/* ── Comparaison YoY ──────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {yoy.currentYear ?? "Exercice"} vs {yoy.previousYear ?? "N-1"}
          </h3>
        </div>

        <YoyRow
          label="Revenus"
          currentCents={yoy.currentRevenueCents}
          previousCents={yoy.previousRevenueCents}
          deltaPercent={yoy.revenueDeltaPercent}
        />
        <YoyRow
          label="Charges"
          currentCents={yoy.currentExpensesCents}
          previousCents={yoy.previousExpensesCents}
        />
        <YoyRow
          label="Résultat"
          currentCents={yoy.currentResultCents}
          previousCents={yoy.previousResultCents}
          highlight
        />

        {yoy.previousYear === null && (
          <p className="text-xs text-muted-foreground pt-1">
            Aucun exercice précédent à comparer.
          </p>
        )}
      </div>

      {/* ── Charges récupérées ──────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Charges récupérées
          </h3>
        </div>
        <p className="text-2xl font-bold text-foreground">
          {formatCents(recoverableChargesCents)}
        </p>
        <p className="text-xs text-muted-foreground">
          Compte 708xxx sur l'exercice courant — TEOM, refacturations et
          régularisations encaissées du locataire.
        </p>
        <Link
          href="/owner/accounting/grand-livre?account=708"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Détail au grand livre <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

// ── Sous-composant : ligne YoY ──────────────────────────────────────

interface YoyRowProps {
  label: string;
  currentCents: number;
  previousCents: number;
  deltaPercent?: number | null;
  highlight?: boolean;
}

function YoyRow({
  label,
  currentCents,
  previousCents,
  deltaPercent,
  highlight,
}: YoyRowProps) {
  // Calcul du delta si pas fourni explicitement (charges, résultat).
  const computedDelta =
    deltaPercent !== undefined
      ? deltaPercent
      : previousCents > 0
        ? Math.round(((currentCents - previousCents) / previousCents) * 1000) /
          10
        : null;

  return (
    <div className="flex items-center justify-between text-sm">
      <span
        className={
          highlight
            ? "font-semibold text-foreground"
            : "text-muted-foreground"
        }
      >
        {label}
      </span>
      <div className="flex items-center gap-2 text-right">
        <span
          className={
            highlight ? "font-semibold text-foreground" : "text-foreground"
          }
        >
          {formatCents(currentCents)}
        </span>
        {computedDelta !== null && (
          <span
            className={`inline-flex items-center text-xs font-medium ${
              computedDelta >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {computedDelta >= 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {Math.abs(computedDelta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
