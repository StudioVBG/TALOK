// @ts-nocheck
"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PlanGate } from "@/components/subscription/plan-gate";
import { ExportCard } from "@/components/accounting/ExportCard";
import { FECPreview } from "@/components/accounting/FECPreview";
import { formatCents } from "@/lib/utils/format-cents";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useEntityStore } from "@/stores/useEntityStore";
import {
  FileText,
  FileSpreadsheet,
  BookOpen,
  Scale,
  ShieldCheck,
  UserPlus,
  Send,
  Mail,
  ChevronDown,
} from "lucide-react";

import type {
  AccountingExercise,
  AccountingBalance,
} from "@/lib/hooks/use-accounting-dashboard";

// ── Types ───────────────────────────────────────────────────────────

interface FECPreviewResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  lineCount: number;
}

interface ECAccess {
  id: string;
  ec_name: string;
  ec_email: string;
  access_level: "read" | "annotate" | "validate";
  is_active: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────

async function downloadBlob(url: string, filename: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Erreur lors du telechargement");
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

// ── Main component ──────────────────────────────────────────────────

export default function ExportsPageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <ExportsContent />
    </PlanGate>
  );
}

function ExportsContent() {
  const { profile } = useAuth();
  const { getActiveEntity } = useEntityStore();
  const activeEntity = getActiveEntity();
  const entityId = activeEntity?.id ?? profile?.default_entity_id;

  // ── Exercise selector ─────────────────────────────────────────────

  const { data: exercises } = useQuery({
    queryKey: ["accounting", "exercises", entityId],
    queryFn: () =>
      apiClient.get<AccountingExercise[]>(
        `/accounting/exercises?entityId=${entityId}`
      ),
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000,
  });

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null
  );

  const currentExercise =
    exercises?.find((e: AccountingExercise) => e.id === selectedExerciseId) ??
    exercises?.find((e: AccountingExercise) => e.status === "open") ??
    exercises?.[0] ??
    null;

  const exerciseId = currentExercise?.id ?? null;

  // ── Balance data (for fiscal recap) ───────────────────────────────

  const { data: balance } = useQuery({
    queryKey: ["accounting", "balance", exerciseId],
    queryFn: () =>
      apiClient.get<AccountingBalance>(
        `/accounting/exercises/${exerciseId}/balance`
      ),
    enabled: !!exerciseId,
    staleTime: 2 * 60 * 1000,
  });

  // ── EC access ─────────────────────────────────────────────────────

  const { data: ecAccess, refetch: refetchEC } = useQuery({
    queryKey: ["ec_access", entityId],
    queryFn: () =>
      apiClient.get<ECAccess[]>(
        `/accounting/ec-access?entityId=${entityId}`
      ),
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000,
  });

  const activeEC = ecAccess?.find((ec: ECAccess) => ec.is_active) ?? null;

  // ── FEC preview ───────────────────────────────────────────────────

  const [fecPreview, setFecPreview] = useState<FECPreviewResult | null>(null);
  const [fecPreviewLoading, setFecPreviewLoading] = useState(false);

  const loadFECPreview = useCallback(async () => {
    if (!exerciseId) return;
    setFecPreviewLoading(true);
    try {
      const data = await apiClient.get<FECPreviewResult>(
        `/accounting/fec/${exerciseId}?preview=true`
      );
      setFecPreview(data);
    } catch {
      setFecPreview({
        valid: false,
        errors: ["Impossible de charger la preview FEC"],
        warnings: [],
        lineCount: 0,
      });
    } finally {
      setFecPreviewLoading(false);
    }
  }, [exerciseId]);

  // ── Download states ───────────────────────────────────────────────

  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const setLoading = (key: string, v: boolean) =>
    setLoadingMap((prev: Record<string, boolean>) => ({ ...prev, [key]: v }));

  const handleDownload = useCallback(
    async (key: string, url: string, filename: string) => {
      setLoading(key, true);
      try {
        await downloadBlob(`/api${url}`, filename);
      } catch (err) {
        console.error(`[ExportsPage] Download error (${key}):`, err);
      } finally {
        setLoading(key, false);
      }
    },
    []
  );

  // ── EC invite form ────────────────────────────────────────────────

  const [showECForm, setShowECForm] = useState(false);
  const [ecForm, setECForm] = useState({
    name: "",
    email: "",
    accessLevel: "read" as "read" | "annotate" | "validate",
  });

  const inviteEC = useMutation({
    mutationFn: async () => {
      await apiClient.post("/accounting/ec-access", {
        entityId,
        ec_name: ecForm.name,
        ec_email: ecForm.email,
        access_level: ecForm.accessLevel,
      });
    },
    onSuccess: () => {
      setShowECForm(false);
      setECForm({ name: "", email: "", accessLevel: "read" });
      refetchEC();
    },
  });

  const sendExportsToEC = useMutation({
    mutationFn: async () => {
      await apiClient.post("/accounting/ec-access/send-exports", {
        entityId,
        exerciseId,
      });
    },
  });

  // ── FEC download ──────────────────────────────────────────────────

  const [fecDownloading, setFecDownloading] = useState(false);

  const handleFECDownload = useCallback(async () => {
    if (!exerciseId || !activeEntity?.siret) return;
    const siren = activeEntity.siret.substring(0, 9);
    setFecDownloading(true);
    try {
      await downloadBlob(
        `/api/accounting/fec/${exerciseId}?siren=${siren}`,
        `${siren}FEC.txt`
      );
    } catch (err) {
      console.error("[ExportsPage] FEC download error:", err);
    } finally {
      setFecDownloading(false);
    }
  }, [exerciseId, activeEntity?.siret]);

  // ── Render ────────────────────────────────────────────────────────

  if (!entityId) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Veuillez selectionner une entite pour acceder aux exports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Exports comptables
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Documents fiscaux, grand livre, balance et FEC
          </p>
        </div>

        {/* Exercise selector */}
        {exercises && exercises.length > 0 && (
          <div className="relative">
            <select
              value={currentExercise?.id ?? ""}
              onChange={(e) => {
                setSelectedExerciseId(e.target.value);
                setFecPreview(null);
              }}
              className="appearance-none bg-card border border-border rounded-lg px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.label} ({ex.status === "open" ? "En cours" : "Cloture"})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      {/* ── Section: Documents fiscaux ─────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-manrope)]">
          Documents fiscaux
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recapitulatif annuel */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-primary mt-0.5">
                <FileText className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground font-[family-name:var(--font-manrope)]">
                  Recapitulatif annuel
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Synthese des revenus, charges et resultat net de l'exercice.
                </p>
              </div>
            </div>

            {/* KPI row */}
            {balance && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Revenus
                  </p>
                  <p className="text-sm font-bold text-emerald-500">
                    {formatCents(balance.revenueCents)}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Charges
                  </p>
                  <p className="text-sm font-bold text-red-500">
                    {formatCents(balance.expensesCents)}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Resultat
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {formatCents(balance.resultCents)}
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                handleDownload(
                  "fiscal-pdf",
                  `/accounting/fiscal?format=pdf&year=${currentExercise?.startDate?.substring(0, 4) ?? new Date().getFullYear()}`,
                  `recap_annuel_${currentExercise?.label ?? "exercice"}.pdf`
                )
              }
              disabled={loadingMap["fiscal-pdf"]}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-muted/50 hover:bg-muted text-foreground border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
            >
              {loadingMap["fiscal-pdf"] ? "Telechargement..." : "Telecharger PDF"}
            </button>
          </div>

          {/* Charges deductibles */}
          <ExportCard
            title="Charges deductibles"
            description="Liste des charges par categorie (comptes 6xx) pour l'exercice selectionne."
            icon={<FileSpreadsheet className="w-5 h-5" />}
            formats={[
              {
                label: "Telecharger CSV",
                loading: loadingMap["charges-csv"],
                onClick: () =>
                  handleDownload(
                    "charges-csv",
                    `/accounting/fiscal?format=csv&year=${currentExercise?.startDate?.substring(0, 4) ?? new Date().getFullYear()}`,
                    `charges_deductibles_${currentExercise?.label ?? "exercice"}.csv`
                  ),
              },
            ]}
          />
        </div>
      </section>

      {/* ── Section: Exports comptables ────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-manrope)]">
          Exports comptables
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Grand livre */}
          <ExportCard
            title="Grand livre"
            description="Toutes les ecritures classees par compte, avec le detail des mouvements."
            icon={<BookOpen className="w-5 h-5" />}
            formats={[
              {
                label: "PDF",
                loading: loadingMap["gl-pdf"],
                onClick: () =>
                  exerciseId &&
                  handleDownload(
                    "gl-pdf",
                    `/accounting/exercises/${exerciseId}/grand-livre?format=pdf`,
                    `grand_livre_${currentExercise?.label ?? "exercice"}.pdf`
                  ),
                disabled: !exerciseId,
              },
              {
                label: "CSV",
                loading: loadingMap["gl-csv"],
                onClick: () =>
                  exerciseId &&
                  handleDownload(
                    "gl-csv",
                    `/accounting/exercises/${exerciseId}/grand-livre?format=csv`,
                    `grand_livre_${currentExercise?.label ?? "exercice"}.csv`
                  ),
                disabled: !exerciseId,
              },
            ]}
          />

          {/* Balance generale */}
          <ExportCard
            title="Balance generale"
            description="Soldes de chaque compte avec totaux debit et credit de l'exercice."
            icon={<Scale className="w-5 h-5" />}
            formats={[
              {
                label: "PDF",
                loading: loadingMap["bal-pdf"],
                onClick: () =>
                  exerciseId &&
                  handleDownload(
                    "bal-pdf",
                    `/accounting/exercises/${exerciseId}/balance?format=pdf`,
                    `balance_${currentExercise?.label ?? "exercice"}.pdf`
                  ),
                disabled: !exerciseId,
              },
              {
                label: "CSV",
                loading: loadingMap["bal-csv"],
                onClick: () =>
                  exerciseId &&
                  handleDownload(
                    "bal-csv",
                    `/accounting/exercises/${exerciseId}/balance?format=csv`,
                    `balance_${currentExercise?.label ?? "exercice"}.csv`
                  ),
                disabled: !exerciseId,
              },
            ]}
          />

          {/* Export FEC */}
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 flex flex-col gap-3 md:col-span-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-teal-500 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground font-[family-name:var(--font-manrope)]">
                  Export FEC
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Fichier des Ecritures Comptables au format reglementaire. Obligatoire en
                  cas de controle fiscal.
                </p>
              </div>
            </div>

            <PlanGate feature="bank_reconciliation" mode="blur">
              <div className="space-y-3">
                {!fecPreview && (
                  <button
                    type="button"
                    onClick={loadFECPreview}
                    disabled={fecPreviewLoading || !exerciseId}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {fecPreviewLoading
                      ? "Verification en cours..."
                      : "Verifier et generer le FEC"}
                  </button>
                )}

                {fecPreview && (
                  <FECPreview
                    lineCount={fecPreview.lineCount}
                    errors={fecPreview.errors}
                    warnings={fecPreview.warnings}
                    onDownload={handleFECDownload}
                    downloading={fecDownloading}
                  />
                )}
              </div>
            </PlanGate>
          </div>
        </div>
      </section>

      {/* ── Section: Expert-comptable ──────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-manrope)]">
          Expert-comptable
        </h2>

        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 space-y-4">
          {activeEC ? (
            <>
              {/* EC info */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {activeEC.ec_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeEC.ec_email}
                  </p>
                  <span className="inline-block mt-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {activeEC.access_level === "read" && "Lecture seule"}
                    {activeEC.access_level === "annotate" && "Annotation"}
                    {activeEC.access_level === "validate" && "Validation"}
                  </span>
                </div>
              </div>

              {/* Send exports */}
              <button
                type="button"
                onClick={() => sendExportsToEC.mutate()}
                disabled={sendExportsToEC.isPending || !exerciseId}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {sendExportsToEC.isPending
                  ? "Envoi en cours..."
                  : "Envoyer les exports"}
              </button>

              {sendExportsToEC.isSuccess && (
                <p className="text-xs text-emerald-500">
                  Exports envoyes avec succes.
                </p>
              )}
              {sendExportsToEC.isError && (
                <p className="text-xs text-red-500">
                  Erreur lors de l'envoi. Veuillez reessayer.
                </p>
              )}
            </>
          ) : (
            <>
              {!showECForm ? (
                <button
                  type="button"
                  onClick={() => setShowECForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Inviter mon expert-comptable
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    inviteEC.mutate();
                  }}
                  className="space-y-3 max-w-md"
                >
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Nom
                    </label>
                    <input
                      type="text"
                      required
                      value={ecForm.name}
                      onChange={(e) =>
                        setECForm((f: typeof ecForm) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Cabinet Dupont"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={ecForm.email}
                      onChange={(e) =>
                        setECForm((f: typeof ecForm) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="contact@cabinet.fr"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Niveau d'acces
                    </label>
                    <select
                      value={ecForm.accessLevel}
                      onChange={(e) =>
                        setECForm((f: typeof ecForm) => ({
                          ...f,
                          accessLevel: e.target.value as
                            | "read"
                            | "annotate"
                            | "validate",
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="read">Lecture seule</option>
                      <option value="annotate">Annotation</option>
                      <option value="validate">Validation</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={inviteEC.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {inviteEC.isPending
                        ? "Envoi en cours..."
                        : "Envoyer l'invitation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowECForm(false)}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Annuler
                    </button>
                  </div>

                  {inviteEC.isError && (
                    <p className="text-xs text-red-500">
                      Erreur lors de l'invitation. Veuillez reessayer.
                    </p>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
