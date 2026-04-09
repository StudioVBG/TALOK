"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  ArrowLeft,
  Receipt,
  Trash2,
  Calculator,
  Upload,
  Euro,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/helpers/format";
import {
  CHARGE_CATEGORIES,
  getCategoryLabel,
  type ChargeCategoryCode,
  type ChargeCategory,
  type ChargeEntry,
} from "@/lib/charges";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();

export default function OwnerPropertyChargesPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const propertyId = params.id as string;

  const [categories, setCategories] = useState<ChargeCategory[]>([]);
  const [entries, setEntries] = useState<ChargeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState(currentYear);

  // Dialogs
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showEntryDialog, setShowEntryDialog] = useState(false);

  // Category form
  const [catForm, setCatForm] = useState({
    category: "" as ChargeCategoryCode | "",
    label: "",
    is_recoverable: true,
    annual_budget_cents: 0,
  });

  // Entry form
  const [entryForm, setEntryForm] = useState({
    category_id: "",
    label: "",
    amount_cents: 0,
    date: new Date().toISOString().split("T")[0],
    is_recoverable: true,
  });

  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [catRes, entryRes] = await Promise.all([
        fetch(`/api/charges/categories?property_id=${propertyId}`),
        fetch(
          `/api/charges/entries?property_id=${propertyId}&fiscal_year=${fiscalYear}`
        ),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }
      if (entryRes.ok) {
        const entryData = await entryRes.json();
        setEntries(entryData.entries || []);
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les charges",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, fiscalYear, toast]);

  useEffect(() => {
    if (propertyId) fetchData();
  }, [propertyId, fiscalYear, fetchData]);

  const handleAddCategory = async () => {
    if (!catForm.category || !catForm.label) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/charges/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          category: catForm.category,
          label: catForm.label,
          is_recoverable: catForm.is_recoverable,
          annual_budget_cents: Math.round(catForm.annual_budget_cents * 100),
        }),
      });
      if (res.ok) {
        toast({ title: "Catégorie ajoutée" });
        setShowCategoryDialog(false);
        setCatForm({
          category: "",
          label: "",
          is_recoverable: true,
          annual_budget_cents: 0,
        });
        fetchData();
      } else {
        const err = await res.json();
        toast({
          title: "Erreur",
          description: err.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEntry = async () => {
    if (!entryForm.category_id || !entryForm.label || entryForm.amount_cents <= 0) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/charges/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          category_id: entryForm.category_id,
          label: entryForm.label,
          amount_cents: Math.round(entryForm.amount_cents * 100),
          date: entryForm.date,
          is_recoverable: entryForm.is_recoverable,
          fiscal_year: fiscalYear,
        }),
      });
      if (res.ok) {
        toast({ title: "Charge enregistrée" });
        setShowEntryDialog(false);
        setEntryForm({
          category_id: "",
          label: "",
          amount_cents: 0,
          date: new Date().toISOString().split("T")[0],
          is_recoverable: true,
        });
        fetchData();
      } else {
        const err = await res.json();
        toast({
          title: "Erreur",
          description: err.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const res = await fetch(`/api/charges/entries/${entryId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "Charge supprimée" });
        fetchData();
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  // Summary calculations
  const totalBudget = categories.reduce(
    (s, c) => s + c.annual_budget_cents,
    0
  );
  const totalActual = entries.reduce((s, e) => s + e.amount_cents, 0);
  const totalRecoverable = entries
    .filter((e) => e.is_recoverable)
    .reduce((s, e) => s + e.amount_cents, 0);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2"
              onClick={() =>
                router.push(`/owner/properties/${propertyId}`)
              }
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour au bien
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
                <Receipt className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Charges locatives
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Suivi des charges et provisions par catégorie (décret 87-713)
            </p>
          </motion.div>

          <div className="flex items-center gap-3">
            <Select
              value={String(fiscalYear)}
              onValueChange={(v) => setFiscalYear(parseInt(v, 10))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/owner/properties/${propertyId}/charges/regularization`
                )
              }
            >
              <Calculator className="h-4 w-4 mr-2" /> Régularisation
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Euro className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Budget annuel
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalBudget / 100)}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Charges réelles
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalActual / 100)}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Récupérables
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalRecoverable / 100)}
                </p>
              </div>
            </div>
          </GlassCard>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Categories sidebar */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Catégories
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCategoryDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Ajouter
                </Button>
              </div>

              {categories.length === 0 ? (
                <GlassCard className="p-8 text-center">
                  <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Aucune catégorie configurée
                  </p>
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowCategoryDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Première catégorie
                  </Button>
                </GlassCard>
              ) : (
                <div className="space-y-3">
                  {categories.map((cat, idx) => {
                    const catEntries = entries.filter(
                      (e) => e.category_id === cat.id
                    );
                    const catTotal = catEntries.reduce(
                      (s, e) => s + e.amount_cents,
                      0
                    );
                    const pct =
                      cat.annual_budget_cents > 0
                        ? Math.min(
                            (catTotal / cat.annual_budget_cents) * 100,
                            100
                          )
                        : 0;

                    return (
                      <motion.div
                        key={cat.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <GlassCard className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-foreground text-sm">
                                {cat.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {getCategoryLabel(
                                  cat.category as ChargeCategoryCode
                                )}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                cat.is_recoverable
                                  ? "border-green-300 text-green-700 dark:text-green-400"
                                  : "border-gray-300 text-gray-600"
                              )}
                            >
                              {cat.is_recoverable
                                ? "Récupérable"
                                : "Non récup."}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">
                              {formatCurrency(catTotal / 100)} /{" "}
                              {formatCurrency(
                                cat.annual_budget_cents / 100
                              )}
                            </span>
                            <span className="font-medium text-foreground">
                              {catEntries.length} écritures
                            </span>
                          </div>
                          {cat.annual_budget_cents > 0 && (
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div
                                className={cn(
                                  "h-1.5 rounded-full transition-all",
                                  pct > 90
                                    ? "bg-red-500"
                                    : pct > 70
                                      ? "bg-amber-500"
                                      : "bg-blue-600"
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </GlassCard>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Entries list */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Écritures de charges ({entries.length})
                </h2>
                <Button
                  size="sm"
                  onClick={() => setShowEntryDialog(true)}
                  disabled={categories.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-1" /> Nouvelle charge
                </Button>
              </div>

              {entries.length === 0 ? (
                <GlassCard className="p-12 text-center">
                  <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Receipt className="h-8 w-8 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Aucune charge enregistrée
                  </h3>
                  <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                    Commencez par ajouter les catégories puis saisissez vos
                    charges pour l&apos;année {fiscalYear}.
                  </p>
                </GlassCard>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry, idx) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <GlassCard className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-foreground text-sm truncate">
                                {entry.label}
                              </p>
                              {entry.is_recoverable && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-green-300 text-green-700 dark:text-green-400 shrink-0"
                                >
                                  Récup.
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                {getCategoryLabel(
                                  (entry.category as any)?.category
                                )}
                              </span>
                              <span>{entry.date}</span>
                              {entry.justificatif_document_id && (
                                <Upload className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-foreground whitespace-nowrap">
                              {formatCurrency(entry.amount_cents / 100)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                              onClick={() => handleDeleteEntry(entry.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Category Dialog */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une catégorie de charges</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Type (décret 87-713)
                </label>
                <Select
                  value={catForm.category}
                  onValueChange={(v) => {
                    const def = CHARGE_CATEGORIES.find((c) => c.code === v);
                    setCatForm({
                      ...catForm,
                      category: v as ChargeCategoryCode,
                      label: def?.label || "",
                    });
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARGE_CATEGORIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Libellé personnalisé
                </label>
                <Input
                  className="mt-1"
                  value={catForm.label}
                  onChange={(e) =>
                    setCatForm({ ...catForm, label: e.target.value })
                  }
                  placeholder="Ex: Eau froide collective"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Budget annuel prévisionnel (€)
                </label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  step={0.01}
                  value={catForm.annual_budget_cents || ""}
                  onChange={(e) =>
                    setCatForm({
                      ...catForm,
                      annual_budget_cents: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0,00"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cat-recoverable"
                  checked={catForm.is_recoverable}
                  onChange={(e) =>
                    setCatForm({
                      ...catForm,
                      is_recoverable: e.target.checked,
                    })
                  }
                  className="rounded border-border"
                />
                <label
                  htmlFor="cat-recoverable"
                  className="text-sm text-foreground"
                >
                  Charge récupérable sur le locataire
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCategoryDialog(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleAddCategory}
                disabled={!catForm.category || !catForm.label || isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Entry Dialog */}
        <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer une charge</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Catégorie
                </label>
                <Select
                  value={entryForm.category_id}
                  onValueChange={(v) =>
                    setEntryForm({ ...entryForm, category_id: v })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Libellé
                </label>
                <Input
                  className="mt-1"
                  value={entryForm.label}
                  onChange={(e) =>
                    setEntryForm({ ...entryForm, label: e.target.value })
                  }
                  placeholder="Ex: Facture eau T1 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Montant (€)
                  </label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={entryForm.amount_cents || ""}
                    onChange={(e) =>
                      setEntryForm({
                        ...entryForm,
                        amount_cents: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Date
                  </label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={entryForm.date}
                    onChange={(e) =>
                      setEntryForm({ ...entryForm, date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="entry-recoverable"
                  checked={entryForm.is_recoverable}
                  onChange={(e) =>
                    setEntryForm({
                      ...entryForm,
                      is_recoverable: e.target.checked,
                    })
                  }
                  className="rounded border-border"
                />
                <label
                  htmlFor="entry-recoverable"
                  className="text-sm text-foreground"
                >
                  Charge récupérable
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEntryDialog(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleAddEntry}
                disabled={
                  !entryForm.category_id ||
                  !entryForm.label ||
                  entryForm.amount_cents <= 0 ||
                  isSaving
                }
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
