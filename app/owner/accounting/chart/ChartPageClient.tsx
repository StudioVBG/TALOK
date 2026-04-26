"use client";

import { useMemo, useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useChartOfAccounts, type ChartAccount } from "@/lib/hooks/use-accounting-entries";
import { Loader2, BookOpen } from "lucide-react";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Actif",
  liability: "Passif",
  equity: "Capitaux",
  income: "Produit",
  expense: "Charge",
};

const ACCOUNT_TYPE_BADGES: Record<string, string> = {
  asset: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  liability: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  equity: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  income: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  expense: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

const ACCOUNT_CLASS_LABELS: Record<string, string> = {
  "1": "Classe 1 — Capitaux",
  "2": "Classe 2 — Immobilisations",
  "3": "Classe 3 — Stocks",
  "4": "Classe 4 — Tiers",
  "5": "Classe 5 — Trésorerie",
  "6": "Classe 6 — Charges",
  "7": "Classe 7 — Produits",
  "8": "Classe 8 — Spéciaux",
};

export default function ChartPageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <ChartContent />
    </PlanGate>
  );
}

function ChartContent() {
  const { data: accounts = [], isLoading, isFetching, error } = useChartOfAccounts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a: ChartAccount) => {
      if (typeFilter && a.account_type !== typeFilter) return false;
      if (!q) return true;
      return (
        a.account_number.toLowerCase().includes(q) ||
        a.label.toLowerCase().includes(q)
      );
    });
  }, [accounts, search, typeFilter]);

  // Group by class (first character of account_number).
  const grouped = useMemo(() => {
    const map = new Map<string, ChartAccount[]>();
    for (const a of filtered) {
      const cls = a.account_number.charAt(0);
      const list = map.get(cls) ?? [];
      list.push(a);
      map.set(cls, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-destructive">
            Erreur lors du chargement du plan comptable.
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
            Plan comptable
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Liste des comptes utilisés par votre entité ({accounts.length} comptes)
          </p>
        </div>
        {isFetching && !isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (n° ou libellé)"
          className="flex-1 min-w-[240px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Tous les types</option>
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!search || !!typeFilter} />
      ) : (
        <div className="space-y-6">
          {grouped.map(([cls, accs]) => (
            <section
              key={cls}
              className="bg-card rounded-xl border border-border overflow-hidden"
            >
              <h2 className="text-sm font-semibold text-foreground px-4 py-2.5 border-b border-border bg-muted/30">
                {ACCOUNT_CLASS_LABELS[cls] ?? `Classe ${cls}`}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({accs.length})
                </span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground bg-muted/10 border-b border-border">
                      <th className="text-left font-medium px-4 py-2">N° compte</th>
                      <th className="text-left font-medium px-4 py-2">Libellé</th>
                      <th className="text-left font-medium px-4 py-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accs.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground">
                          {a.account_number}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">{a.label}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${
                              ACCOUNT_TYPE_BADGES[a.account_type] ??
                              "bg-slate-500/10 text-slate-500 border-slate-500/20"
                            }`}
                          >
                            {ACCOUNT_TYPE_LABELS[a.account_type] ?? a.account_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun compte ne correspond aux filtres.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <BookOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Aucun compte initialisé pour cette entité. Créez votre premier exercice
        pour amorcer le plan comptable PCG par défaut.
      </p>
    </div>
  );
}
