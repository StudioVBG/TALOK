"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated

import { useRef, useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useDocumentAnalysis } from "@/lib/hooks/use-document-analysis";
import { useChartOfAccounts } from "@/lib/hooks/use-accounting-entries";
import { UploadStepIndicator } from "@/components/accounting/UploadStepIndicator";
import { ConfidenceBanner } from "@/components/accounting/ConfidenceBanner";
import { ConfidenceField } from "@/components/accounting/ConfidenceField";
import { ProposedEntry } from "@/components/accounting/ProposedEntry";
import { AnalysisProgress } from "@/components/accounting/AnalysisProgress";
import { formatCents } from "@/lib/utils/format-cents";
import { useEntityStore } from "@/stores/useEntityStore";
import Link from "next/link";
import {
  Camera,
  Upload,
  Mail,
  FileText,
  Check,
  AlertTriangle,
  ArrowLeft,
  Plus,
  RefreshCw,
} from "lucide-react";

export default function UploadFlowClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <UploadFlowContent />
    </PlanGate>
  );
}

function UploadFlowContent() {
  const {
    step, file, analysis, upload, retryAnalysis: analyze, validate, reset,
    isUploading, isAnalyzing, error, setError,
  } = useDocumentAnalysis() as any;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [validationResult, setValidationResult] = useState<Record<string, unknown> | null>(null);

  // Overrides for step 3 form
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});

  const extracted = analysis?.extracted_data ?? {};
  const confidence = analysis?.confidence_score ?? 0;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 10 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 10 Mo)");
      return;
    }

    await (upload as any)(selected);
    await (analyze as any)()
  };

  const handleValidate = async () => {
    const result = await (validate as any)(overrides);
    if (result) setValidationResult(result);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/owner/accounting" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Scanner un justificatif</h1>
      </div>

      <UploadStepIndicator currentStep={step} />

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p>{error}</p>
            {step === 2 && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setError(null); analyze(); }} className="text-xs underline">Reessayer</button>
                <button onClick={reset} className="text-xs underline">Saisir manuellement</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Acquisition */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploading}
              className="bg-card rounded-xl border border-border p-6 text-center hover:border-primary transition-colors"
            >
              <Camera className="w-8 h-8 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Photo</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-card rounded-xl border border-border p-6 text-center hover:border-primary transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-primary" />
              <span className="text-sm font-medium">Fichier</span>
            </button>
            <button disabled className="bg-card rounded-xl border border-border p-6 text-center opacity-50">
              <Mail className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Email</span>
              <span className="text-xs text-muted-foreground block">Bientot</span>
            </button>
          </div>

          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileSelect} />

          {file && (
            <div className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} Ko</p>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            PDF, JPEG ou PNG — 10 Mo maximum
          </p>
        </div>
      )}

      {/* Step 2: Analysis in progress */}
      {step === 2 && (
        <AnalysisProgress
          status={isAnalyzing ? "analyzing" : error ? "failed" : "completed"}
        />
      )}

      {/* Step 3: Verification */}
      {step === 3 && analysis && (
        <div className="space-y-4">
          <ConfidenceBanner score={confidence * 100} />

          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Informations extraites</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ConfidenceField label="Type" confidence={confidence}>
                <select
                  value={String(overrides.documentType ?? (extracted as any).document_type ?? "")}
                  onChange={(e) => setOverrides({ ...overrides, documentType: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="facture">Facture</option>
                  <option value="quittance">Quittance</option>
                  <option value="releve_bancaire">Releve bancaire</option>
                  <option value="avis_impot">Avis d&apos;imposition</option>
                  <option value="autre">Autre</option>
                </select>
              </ConfidenceField>

              <ConfidenceField label="Fournisseur" confidence={confidence}>
                <input
                  type="text"
                  defaultValue={((extracted.emetteur as Record<string, unknown>)?.nom as string) ?? ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </ConfidenceField>

              <ConfidenceField label="Montant TTC" confidence={confidence}>
                <input
                  type="text"
                  defaultValue={extracted.montant_ttc_cents ? formatCents(extracted.montant_ttc_cents as number) : ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value.replace(/[^\d,.-]/g, "").replace(",", "."));
                    if (!isNaN(val)) setOverrides({ ...overrides, amount: Math.round(val * 100) });
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </ConfidenceField>

              <ConfidenceField label="Date" confidence={confidence}>
                <input
                  type="date"
                  defaultValue={(extracted.date_document as string) ?? ""}
                  onChange={(e) => setOverrides({ ...overrides, entryDate: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </ConfidenceField>

              <ConfidenceField label="Compte comptable" confidence={confidence}>
                <input
                  type="text"
                  defaultValue={analysis.suggested_account ?? ""}
                  onChange={(e) => setOverrides({ ...overrides, accountNumber: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Ex: 615100"
                />
              </ConfidenceField>

              <ConfidenceField label="Journal" confidence={confidence}>
                <select
                  defaultValue={analysis.suggested_journal ?? "ACH"}
                  onChange={(e) => setOverrides({ ...overrides, journalCode: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ACH">Achats</option>
                  <option value="VE">Ventes</option>
                  <option value="BQ">Banque</option>
                  <option value="OD">Operations diverses</option>
                </select>
              </ConfidenceField>
            </div>

            {/* SIRET + TVA badges */}
            <div className="flex flex-wrap gap-2">
              {analysis.siret_verified !== null && (
                <span className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${
                  analysis.siret_verified ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                }`}>
                  SIRET {analysis.siret_verified ? "verifie" : "non verifie"}
                </span>
              )}
              {analysis.tva_coherent !== null && (
                <span className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${
                  analysis.tva_coherent ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                }`}>
                  TVA {analysis.tva_coherent ? "coherente" : "incoherente"}
                </span>
              )}
            </div>

            {/* Alerts */}
            {Array.isArray((extracted as Record<string, unknown>).alerts) && ((extracted as Record<string, unknown>).alerts as string[]).length > 0 && (
              <div className="space-y-1">
                {((extracted as Record<string, unknown>).alerts as string[]).map((alert: string, i: number) => (
                  <div key={i} className="bg-destructive/10 text-destructive text-xs p-2 rounded">
                    {alert}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Proposed entry */}
          <ProposedEntry
            lines={[
              {
                account: (overrides.accountNumber as string) ?? analysis.suggested_account ?? "615100",
                label: "Charge",
                debitCents: (overrides.amount as number) ?? (extracted.montant_ttc_cents as number) ?? 0,
                creditCents: 0,
              },
              {
                account: "401000",
                label: "Fournisseur",
                debitCents: 0,
                creditCents: (overrides.amount as number) ?? (extracted.montant_ttc_cents as number) ?? 0,
              },
            ]}
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleValidate}
              className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-3 text-sm font-medium hover:bg-primary/90"
            >
              Valider et comptabiliser
            </button>
            <button
              onClick={() => setOverrides({})}
              className="flex-1 bg-card border border-border text-foreground rounded-lg px-4 py-3 text-sm font-medium hover:bg-accent"
            >
              Reinitialiser
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 4 && (
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center animate-in zoom-in duration-300">
            <Check className="w-8 h-8 text-emerald-500" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-foreground">Justificatif comptabilise</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {extracted.montant_ttc_cents ? formatCents(extracted.montant_ttc_cents as number) : ""} — {(extracted.document_type as string) ?? "Document"}
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 space-y-2 text-left">
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Ecriture comptable creee</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Document archive</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Piece justificative liee</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/owner/accounting"
              className="flex-1 bg-card border border-border text-foreground rounded-lg px-4 py-3 text-sm font-medium text-center hover:bg-accent"
            >
              Dashboard
            </Link>
            <button
              onClick={reset}
              className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-3 text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter un autre
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
