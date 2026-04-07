"use client";

import { PlanGate } from "@/components/subscription/plan-gate";
import { useAccountingDashboard } from "@/lib/hooks/use-accounting-dashboard";
import { AccountingKPICard } from "@/components/accounting/AccountingKPICard";
import { RecentEntries } from "@/components/accounting/RecentEntries";
import { AccountingEmptyState } from "@/components/accounting/AccountingEmptyState";
import { formatCents } from "@/lib/utils/format-cents";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Calculator,
  FileText,
  Upload,
  Building2,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function AccountingDashboard() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <AccountingDashboardContent />
    </PlanGate>
  );
}

function AccountingDashboardContent() {
  const { balance, recentEntries, currentExercise, isLoading, error } =
    useAccountingDashboard();

  if (isLoading) {
    return <AccountingDashboardLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-destructive">
            Erreur lors du chargement des donnees comptables. Veuillez
            reessayer.
          </p>
        </div>
      </div>
    );
  }

  const hasEntries = recentEntries.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Comptabilite
          </h1>
          {currentExercise && (
            <p className="text-sm text-muted-foreground mt-1">
              Exercice : {currentExercise.label} ({currentExercise.status === "open" ? "En cours" : "Cloture"})
            </p>
          )}
        </div>
      </div>

      {!hasEntries && !balance ? (
        <AccountingEmptyState />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AccountingKPICard
              title="Recettes"
              value={balance?.revenueCents ?? 0}
              color="green"
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <AccountingKPICard
              title="Depenses"
              value={balance?.expensesCents ?? 0}
              color="red"
              icon={<TrendingDown className="w-5 h-5" />}
            />
            <AccountingKPICard
              title="Resultat"
              value={balance?.resultCents ?? 0}
              color="blue"
              icon={<Wallet className="w-5 h-5" />}
            />
            <AccountingKPICard
              title="Solde total"
              value={
                (balance?.totalDebitCents ?? 0) -
                (balance?.totalCreditCents ?? 0)
              }
              color="orange"
              icon={<Calculator className="w-5 h-5" />}
            />
          </div>

          {/* Monthly chart */}
          {balance?.monthlySeries && balance.monthlySeries.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Evolution mensuelle
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={balance.monthlySeries}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickFormatter={(v: string) => {
                        const [, m] = v.split("-");
                        const months = [
                          "Jan",
                          "Fev",
                          "Mar",
                          "Avr",
                          "Mai",
                          "Juin",
                          "Juil",
                          "Aout",
                          "Sep",
                          "Oct",
                          "Nov",
                          "Dec",
                        ];
                        return months[parseInt(m, 10) - 1] ?? m;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickFormatter={(v: number) => formatCents(v)}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => [
                        formatCents(value),
                        name === "debitCents" ? "Debit" : "Credit",
                      ]}
                      labelFormatter={(label: string) => {
                        const [y, m] = label.split("-");
                        return `${m}/${y}`;
                      }}
                    />
                    <Bar
                      dataKey="debitCents"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      name="debitCents"
                    />
                    <Bar
                      dataKey="creditCents"
                      fill="hsl(142 71% 45%)"
                      radius={[4, 4, 0, 0]}
                      name="creditCents"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction
              href="/owner/accounting/entries/new"
              icon={<FileText className="w-5 h-5" />}
              label="Nouvelle ecriture"
            />
            <QuickAction
              href="/owner/documents/upload"
              icon={<Upload className="w-5 h-5" />}
              label="Scanner justificatif"
            />
            <QuickAction
              href="/owner/money/settings"
              icon={<Building2 className="w-5 h-5" />}
              label="Rapprochement bancaire"
            />
            <QuickAction
              href="/owner/accounting/export"
              icon={<Download className="w-5 h-5" />}
              label="Exporter FEC"
            />
          </div>

          {/* Recent entries */}
          <RecentEntries entries={recentEntries} />
        </>
      )}
    </div>
  );
}

// ── Quick action button ──────────────────────────────────────────────

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 bg-card rounded-xl border border-border p-4 text-center hover:bg-muted/50 transition-colors"
    >
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </Link>
  );
}

// ── Loading skeleton (client-side) ──────────────────────────────────

function AccountingDashboardLoadingSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
