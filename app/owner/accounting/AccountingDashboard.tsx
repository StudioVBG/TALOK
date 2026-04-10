"use client";

import { useState, useEffect } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useAccountingDashboard } from "@/lib/hooks/use-accounting-dashboard";
import { AccountingKPICard } from "@/components/accounting/AccountingKPICard";
import { RecentEntries } from "@/components/accounting/RecentEntries";
import { AccountingEmptyState } from "@/components/accounting/AccountingEmptyState";
import { formatCents } from "@/lib/utils/format-cents";
import { useEntityStore } from "@/stores/useEntityStore";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus,
  Receipt,
  Trash2,
  Loader2,
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
              title="Prelevements sociaux"
              value={
                (balance?.resultCents ?? 0) > 0
                  ? Math.round((balance?.resultCents ?? 0) * 0.172)
                  : 0
              }
              color="orange"
              icon={<Calculator className="w-5 h-5" />}
              subtitle="17,2% (CSG + CRDS + solidarite)"
              hidden={(balance?.resultCents ?? 0) <= 0}
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
                      formatter={((value: unknown, name: unknown) => [
                        formatCents(typeof value === "number" ? value : Number(value) || 0),
                        name === "debitCents" ? "Debit" : "Credit",
                      ]) as never}
                      labelFormatter={((label: unknown) => {
                        const str = typeof label === "string" ? label : String(label ?? "");
                        const [y, m] = str.split("-");
                        return `${m}/${y}`;
                      }) as never}
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

          {/* Expenses + Exports */}
          <ExpensesAndExports />
        </>
      )}
    </div>
  );
}

// ── Expenses section + FEC/Fiscal exports ─────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  travaux: "Travaux / réparations",
  entretien: "Entretien courant",
  assurance: "Assurance",
  taxe_fonciere: "Taxe foncière",
  charges_copro: "Charges copropriété",
  frais_gestion: "Frais de gestion",
  frais_bancaires: "Frais bancaires",
  diagnostic: "Diagnostics",
  mobilier: "Mobilier",
  honoraires: "Honoraires",
  autre: "Autre",
};

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(v);
}

function ExpensesAndExports() {
  const { toast } = useToast();
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const entityParam = activeEntityId ? `&entityId=${encodeURIComponent(activeEntityId)}` : "";
  const currentYear = new Date().getFullYear();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [exporting, setExporting] = useState<"fec" | "fiscal" | null>(null);

  useEffect(() => {
    setLoadingExpenses(true);
    fetch(`/api/accounting/expenses?year=${currentYear}${entityParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setExpenses(d?.expenses || []))
      .catch(() => {})
      .finally(() => setLoadingExpenses(false));
  }, [currentYear, activeEntityId]);

  const handleExportFEC = async () => {
    setExporting("fec");
    try {
      const res = await fetch(`/api/accounting/fec?year=${currentYear}${entityParam}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur export FEC");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FEC_${currentYear}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export FEC téléchargé" });
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Export impossible", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const handleExportFiscal = async () => {
    setExporting("fiscal");
    try {
      const res = await fetch(`/api/accounting/fiscal-summary?year=${currentYear}${entityParam}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur export");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Recap_fiscal_${currentYear}_Talok.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Récapitulatif fiscal téléchargé" });
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Export impossible", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      {/* Expenses */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-orange-500" />
              Dépenses et charges
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Travaux, assurances, taxes et charges déductibles
            </p>
          </div>
          <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle dépense</DialogTitle>
                <DialogDescription>
                  Ajoutez une dépense pour la retrouver dans vos exports FEC et votre récapitulatif fiscal.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSavingExpense(true);
                  const fd = new FormData(e.target as HTMLFormElement);
                  try {
                    const res = await fetch("/api/accounting/expenses", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        description: fd.get("description"),
                        montant: parseFloat(fd.get("montant") as string),
                        category: fd.get("category"),
                        date_depense: fd.get("date_depense"),
                        fournisseur: fd.get("fournisseur") || null,
                        legal_entity_id: activeEntityId && activeEntityId !== "personal" ? activeEntityId : null,
                      }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      throw new Error(err.error || "Erreur");
                    }
                    const { expense } = await res.json();
                    setExpenses((prev) => [expense, ...prev]);
                    setShowAddExpense(false);
                    toast({ title: "Dépense ajoutée" });
                  } catch (err) {
                    toast({ title: "Erreur", description: err instanceof Error ? err.message : "Impossible d'ajouter", variant: "destructive" });
                  } finally {
                    setSavingExpense(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="exp-desc">Description</Label>
                  <Input id="exp-desc" name="description" required placeholder="Ex: Remplacement chaudière" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="exp-amount">Montant HT (€)</Label>
                    <Input id="exp-amount" name="montant" type="number" step="0.01" min="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exp-date">Date</Label>
                    <Input id="exp-date" name="date_depense" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="exp-cat">Catégorie</Label>
                    <Select name="category" defaultValue="travaux">
                      <SelectTrigger id="exp-cat"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exp-fourn">Fournisseur</Label>
                    <Input id="exp-fourn" name="fournisseur" placeholder="Optionnel" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddExpense(false)}>Annuler</Button>
                  <Button type="submit" disabled={savingExpense}>
                    {savingExpense ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loadingExpenses ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted rounded-lg" />)}
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Aucune dépense enregistrée</p>
            <p className="text-xs mt-1">Ajoutez vos dépenses pour les retrouver dans votre export FEC.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {expenses.slice(0, 10).map((exp: any) => (
              <div key={exp.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{exp.description}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{CATEGORY_LABELS[exp.category] || exp.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(exp.date_depense).toLocaleDateString("fr-FR")}
                    {exp.fournisseur ? ` — ${exp.fournisseur}` : ""}
                  </p>
                </div>
                <span className="font-semibold text-sm tabular-nums shrink-0">{formatCurrency(Number(exp.montant) || 0)}</span>
                <Button
                  variant="ghost" size="icon"
                  className="shrink-0 text-destructive hover:text-destructive h-7 w-7"
                  onClick={async () => {
                    const res = await fetch(`/api/accounting/expenses/${exp.id}`, { method: "DELETE" });
                    if (res.ok) {
                      setExpenses((prev) => prev.filter((e: any) => e.id !== exp.id));
                      toast({ title: "Dépense supprimée" });
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {expenses.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-1">+ {expenses.length - 10} autres dépenses</p>
            )}
          </div>
        )}
      </div>

      {/* Export buttons */}
      <div className="bg-card rounded-xl border border-dashed border-border p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-sm font-semibold">Exports comptables</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Export pour votre comptable ou récapitulatif fiscal annuel.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportFEC} disabled={!!exporting} className="gap-1.5 text-xs">
              {exporting === "fec" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export FEC {currentYear}
            </Button>
            <Button size="sm" onClick={handleExportFiscal} disabled={!!exporting} className="gap-1.5 text-xs">
              {exporting === "fiscal" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Récap fiscal {currentYear}
            </Button>
          </div>
        </div>
      </div>
    </>
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
