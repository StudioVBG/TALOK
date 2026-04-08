"use client";

import { useState, useMemo, useCallback } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import {
  useCoproBudget,
  COPRO_CHARGE_ACCOUNTS,
  type CreateBudgetLineInput,
} from "@/lib/hooks/use-copro-budget";
import { useCoproSites } from "@/lib/hooks/use-copro-lots";
import { formatCents } from "@/lib/utils/format-cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Plus,
  Trash2,
  Check,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import Link from "next/link";

const PIE_COLORS = [
  "#06b6d4",
  "#2563eb",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#84cc16",
  "#a855f7",
  "#0ea5e9",
  "#e11d48",
  "#22c55e",
];

export default function BudgetClient() {
  return (
    <PlanGate feature="copro_module" mode="blur">
      <BudgetContent />
    </PlanGate>
  );
}

function BudgetContent() {
  const { data: sites } = useCoproSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const activeSiteId = selectedSiteId || sites?.[0]?.id || "";

  const {
    budget,
    previousBudget,
    isLoading,
    createBudget,
    isCreating,
  } = useCoproBudget(activeSiteId);

  const hasBudget = !!budget && budget.status !== "draft";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/syndic/accounting"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Budget previsionnel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {budget?.exercise_label ?? "Nouvel exercice"}
          </p>
        </div>
        {sites && sites.length > 1 && (
          <Select value={activeSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-64">
              <Building2 className="w-4 h-4 mr-2 text-cyan-600" />
              <SelectValue placeholder="Copropriete" />
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

      {isLoading ? (
        <BudgetLoadingSkeleton />
      ) : (
        <Tabs defaultValue={hasBudget ? "active" : "create"}>
          <TabsList>
            <TabsTrigger value="create">
              <Plus className="w-4 h-4 mr-1" />
              Creer / Modifier
            </TabsTrigger>
            {hasBudget && (
              <TabsTrigger value="active">
                <BarChart3 className="w-4 h-4 mr-1" />
                Budget actif
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="create" className="mt-4">
            <BudgetCreateForm
              siteId={activeSiteId}
              previousBudget={previousBudget}
              onSubmit={createBudget}
              isSubmitting={isCreating}
            />
          </TabsContent>

          {hasBudget && (
            <TabsContent value="active" className="mt-4">
              <BudgetActiveView budget={budget} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

// -- Budget Create Form -------------------------------------------------------

interface BudgetCreateFormProps {
  siteId: string;
  previousBudget: ReturnType<typeof useCoproBudget>["previousBudget"];
  onSubmit: (input: { site_id: string; exercise_id: string; lines: CreateBudgetLineInput[] }) => Promise<unknown>;
  isSubmitting: boolean;
}

function BudgetCreateForm({
  siteId,
  previousBudget,
  onSubmit,
  isSubmitting,
}: BudgetCreateFormProps) {
  const [lines, setLines] = useState<
    Array<{ account_number: string; label: string; amount: string }>
  >(
    COPRO_CHARGE_ACCOUNTS.map((acc) => ({
      account_number: acc.account_number,
      label: acc.label,
      amount: "",
    }))
  );

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const val = parseFloat(line.amount);
        return sum + (isNaN(val) ? 0 : val);
      }, 0),
    [lines]
  );

  const n1Map = useMemo(() => {
    if (!previousBudget?.lines) return new Map<string, number>();
    const map = new Map<string, number>();
    previousBudget.lines.forEach((l) => map.set(l.account_number, l.budget_cents));
    return map;
  }, [previousBudget]);

  const updateLine = useCallback(
    (index: number, field: "amount" | "label", value: string) => {
      setLines((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const removeLine = useCallback((index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      { account_number: "619000", label: "", amount: "" },
    ]);
  }, []);

  const handleSubmit = async () => {
    const validLines: CreateBudgetLineInput[] = lines
      .filter((l) => l.label && l.amount && parseFloat(l.amount) > 0)
      .map((l) => ({
        account_number: l.account_number,
        label: l.label,
        budget_cents: Math.round(parseFloat(l.amount) * 100),
      }));

    if (validLines.length === 0) return;

    await onSubmit({
      site_id: siteId,
      exercise_id: crypto.randomUUID(),
      lines: validLines,
    });
  };

  const hasN1 = n1Map.size > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lignes budgetaires</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-4 sm:-mx-6">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium w-24">
                  Compte
                </th>
                <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                  Libelle
                </th>
                <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium w-36">
                  Montant
                </th>
                {hasN1 && (
                  <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium w-32">
                    N-1
                  </th>
                )}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={idx}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="py-2 px-4 sm:px-6">
                    <span className="text-xs font-mono text-muted-foreground">
                      {line.account_number}
                    </span>
                  </td>
                  <td className="py-2 px-4 sm:px-6">
                    <Input
                      value={line.label}
                      onChange={(e) =>
                        updateLine(idx, "label", e.target.value)
                      }
                      placeholder="Libelle"
                      className="h-9 text-sm"
                    />
                  </td>
                  <td className="py-2 px-4 sm:px-6">
                    <Input
                      type="number"
                      value={line.amount}
                      onChange={(e) =>
                        updateLine(idx, "amount", e.target.value)
                      }
                      placeholder="0,00"
                      step="0.01"
                      min="0"
                      className="h-9 text-sm text-right"
                    />
                  </td>
                  {hasN1 && (
                    <td className="py-2 px-4 sm:px-6 text-right text-xs text-muted-foreground">
                      {n1Map.has(line.account_number)
                        ? formatCents(n1Map.get(line.account_number)!)
                        : "-"}
                    </td>
                  )}
                  <td className="py-2 px-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => removeLine(idx)}
                      aria-label="Supprimer la ligne"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="py-3 px-4 sm:px-6" />
                <td className="py-3 px-4 sm:px-6 font-semibold text-foreground">
                  Total
                </td>
                <td className="py-3 px-4 sm:px-6 text-right font-bold text-lg text-foreground">
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(total)}
                </td>
                {hasN1 && <td />}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="w-4 h-4 mr-1" />
            Ajouter une ligne
          </Button>
          <div className="flex-1" />
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || total === 0}
            loading={isSubmitting}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Enregistrer le budget
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Budget Active View -------------------------------------------------------

function BudgetActiveView({
  budget,
}: {
  budget: NonNullable<ReturnType<typeof useCoproBudget>["budget"]>;
}) {
  const pieData = budget.lines
    .filter((l) => l.budget_cents > 0)
    .map((l, i) => ({
      name: l.label,
      value: l.budget_cents / 100,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Budget total"
          value={formatCents(budget.total_budget_cents)}
        />
        <SummaryCard
          label="Realise"
          value={formatCents(budget.total_realise_cents)}
        />
        <SummaryCard
          label="Ecart"
          value={formatCents(budget.total_ecart_cents)}
          highlight={budget.total_ecart_cents < 0 ? "red" : "green"}
        />
        <SummaryCard
          label="Execution"
          value={`${budget.execution_pct}%`}
          highlight={
            budget.execution_pct > 100
              ? "red"
              : budget.execution_pct >= 80
                ? "orange"
                : "green"
          }
        />
      </div>

      {/* Table + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Execution table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Execution par poste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="w-full text-sm min-w-[550px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Poste
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Budget
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Realise
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                      Ecart
                    </th>
                    <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium w-28">
                      % Exec.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {budget.lines.map((line) => {
                    const pct = line.execution_pct;
                    const barColor =
                      pct > 100
                        ? "bg-red-500"
                        : pct >= 80
                          ? "bg-amber-500"
                          : "bg-emerald-500";
                    return (
                      <tr
                        key={line.id}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-3 px-4 sm:px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              {line.account_number}
                            </span>
                            <span className="text-foreground">{line.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 sm:px-6 text-right text-foreground">
                          {formatCents(line.budget_cents)}
                        </td>
                        <td className="py-3 px-4 sm:px-6 text-right text-foreground">
                          {formatCents(line.realise_cents)}
                        </td>
                        <td
                          className={`py-3 px-4 sm:px-6 text-right font-medium ${
                            line.ecart_cents < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatCents(line.ecart_cents)}
                        </td>
                        <td className="py-3 px-4 sm:px-6">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${barColor}`}
                                style={{
                                  width: `${Math.min(100, pct)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground w-10 text-right">
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repartition des charges</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [
                        new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(value),
                        "Montant",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Aucune donnee
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// -- Summary card ------------------------------------------------------------

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "orange" | "red";
}) {
  const highlightColors = {
    green: "text-emerald-600 dark:text-emerald-400",
    orange: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
  };

  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
        <p
          className={`text-lg sm:text-xl font-bold mt-1 ${
            highlight ? highlightColors[highlight] : "text-foreground"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// -- Loading skeleton --------------------------------------------------------

function BudgetLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-muted rounded w-64" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
