"use client";

/**
 * Formulaire de vérification d'avis d'imposition français
 *
 * Permet de vérifier l'authenticité d'un avis d'imposition
 * en saisissant le numéro fiscal et la référence de l'avis.
 */

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2, XCircle, AlertCircle, FileText, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  taxNoticeVerificationRequestSchema,
  formatNumeroFiscalDisplay,
  maskNumeroFiscal,
} from "@/lib/validations/tax-verification";
import type {
  TaxNoticeVerificationResult,
  TaxNoticeSummary,
} from "@/lib/types/tax-verification";

// ============================================================================
// TYPES
// ============================================================================

interface TaxNoticeVerificationFormProps {
  tenantId?: string;
  applicationId?: string;
  onVerificationComplete?: (result: TaxNoticeVerificationResult) => void;
  saveToHistory?: boolean;
  compact?: boolean;
}

type FormData = z.infer<typeof taxNoticeVerificationRequestSchema>;

interface VerificationState {
  isLoading: boolean;
  result: TaxNoticeVerificationResult | null;
  error: string | null;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function TaxNoticeVerificationForm({
  tenantId,
  applicationId,
  onVerificationComplete,
  saveToHistory = true,
  compact = false,
}: TaxNoticeVerificationFormProps) {
  const [state, setState] = useState<VerificationState>({
    isLoading: false,
    result: null,
    error: null,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(taxNoticeVerificationRequestSchema),
    mode: "onBlur",
    defaultValues: {
      numeroFiscal: "",
      referenceAvis: "",
    },
  });

  const onSubmit = useCallback(
    async (data: FormData) => {
      setState({ isLoading: true, result: null, error: null });

      try {
        const response = await fetch("/api/verification/tax-notice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            tenantId,
            applicationId,
            saveToHistory,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setState({
            isLoading: false,
            result: null,
            error: result.error || "Erreur lors de la vérification",
          });
          return;
        }

        setState({ isLoading: false, result, error: null });
        onVerificationComplete?.(result);
      } catch (error) {
        setState({
          isLoading: false,
          result: null,
          error: "Impossible de contacter le serveur",
        });
      }
    },
    [tenantId, applicationId, saveToHistory, onVerificationComplete]
  );

  const resetForm = useCallback(() => {
    form.reset();
    setState({ isLoading: false, result: null, error: null });
  }, [form]);

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      {!compact && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Vérification d'avis d'imposition
          </CardTitle>
          <CardDescription>
            Vérifiez l'authenticité d'un avis d'imposition français via le
            service officiel de l'État.
          </CardDescription>
        </CardHeader>
      )}

      <CardContent className={compact ? "p-0" : ""}>
        {/* Formulaire */}
        {!state.result && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Numéro fiscal */}
            <div className="space-y-2">
              <Label htmlFor="numeroFiscal">Numéro fiscal</Label>
              <Input
                id="numeroFiscal"
                placeholder="1234567890123"
                maxLength={13}
                {...form.register("numeroFiscal")}
                disabled={state.isLoading}
                className="font-mono"
              />
              {form.formState.errors.numeroFiscal && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.numeroFiscal.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                13 chiffres, visible en haut de l'avis d'imposition
              </p>
            </div>

            {/* Référence d'avis */}
            <div className="space-y-2">
              <Label htmlFor="referenceAvis">Référence de l'avis</Label>
              <Input
                id="referenceAvis"
                placeholder="24ABCDEFGHIJK"
                maxLength={13}
                {...form.register("referenceAvis")}
                disabled={state.isLoading}
                className="font-mono uppercase"
              />
              {form.formState.errors.referenceAvis && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.referenceAvis.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                13 caractères, visible en haut de l'avis d'imposition
              </p>
            </div>

            {/* Erreur générale */}
            {state.error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            {/* Bouton de soumission */}
            <Button
              type="submit"
              className="w-full"
              disabled={state.isLoading}
            >
              {state.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vérification en cours...
                </>
              ) : (
                "Vérifier l'avis"
              )}
            </Button>
          </form>
        )}

        {/* Résultat */}
        {state.result && (
          <VerificationResult result={state.result} onReset={resetForm} />
        )}
      </CardContent>

      {!compact && !state.result && (
        <CardFooter className="flex-col items-start gap-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Ce service utilise l'API officielle de la Direction générale des
              Finances publiques (DGFiP). Les données ne sont ni stockées ni
              partagées.
            </p>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

// ============================================================================
// COMPOSANT DE RÉSULTAT
// ============================================================================

interface VerificationResultProps {
  result: TaxNoticeVerificationResult;
  onReset: () => void;
}

function VerificationResult({ result, onReset }: VerificationResultProps) {
  const statusConfig = {
    conforme: {
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      title: "Avis conforme",
    },
    non_conforme: {
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      title: "Avis non conforme",
    },
    situation_partielle: {
      icon: AlertCircle,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      title: "Situation partielle",
    },
    introuvable: {
      icon: XCircle,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      title: "Avis introuvable",
    },
    erreur: {
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      title: "Erreur",
    },
  };

  const config = statusConfig[result.status];
  const Icon = config.icon;

  return (
    <div className="space-y-4">
      {/* Statut principal */}
      <div
        className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}
      >
        <div className="flex items-start gap-3">
          <Icon className={`h-6 w-6 ${config.color} shrink-0`} />
          <div className="flex-1">
            <h3 className={`font-semibold ${config.color}`}>{config.title}</h3>
            <p className="text-sm text-gray-600 mt-1">{result.message}</p>
          </div>
        </div>
      </div>

      {/* Données de l'avis */}
      {result.summary && result.status === "conforme" && (
        <TaxNoticeSummaryCard summary={result.summary} />
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onReset} className="flex-1">
          Nouvelle vérification
        </Button>
      </div>

      {/* Horodatage */}
      <p className="text-xs text-muted-foreground text-center">
        Vérifié le{" "}
        {new Date(result.verifiedAt).toLocaleString("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
        })}
      </p>
    </div>
  );
}

// ============================================================================
// COMPOSANT DE RÉSUMÉ
// ============================================================================

interface TaxNoticeSummaryCardProps {
  summary: TaxNoticeSummary;
}

function TaxNoticeSummaryCard({ summary }: TaxNoticeSummaryCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h4 className="font-medium text-sm text-gray-900">
        Informations de l'avis
      </h4>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Déclarant(s)</p>
          <p className="font-medium">{summary.nomComplet}</p>
        </div>

        <div>
          <p className="text-muted-foreground">Année des revenus</p>
          <p className="font-medium">{summary.anneeRevenus}</p>
        </div>

        <div>
          <p className="text-muted-foreground">Revenu fiscal de référence</p>
          <p className="font-medium">{summary.revenuFiscalReference}</p>
        </div>

        <div>
          <p className="text-muted-foreground">Nombre de parts</p>
          <p className="font-medium">{summary.nombreParts}</p>
        </div>

        <div>
          <p className="text-muted-foreground">Situation familiale</p>
          <p className="font-medium">{summary.situationFamille}</p>
        </div>

        <div>
          <p className="text-muted-foreground">Statut</p>
          <p className="font-medium">
            {summary.isRecent ? (
              <span className="text-green-600">Avis récent</span>
            ) : (
              <span className="text-amber-600">Avis ancien (&gt; 2 ans)</span>
            )}
          </p>
        </div>
      </div>

      <div className="pt-2 border-t">
        <p className="text-muted-foreground text-sm">Adresse du foyer fiscal</p>
        <p className="font-medium text-sm">{summary.adresse}</p>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORT PAR DÉFAUT
// ============================================================================

export default TaxNoticeVerificationForm;
