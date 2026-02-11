"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Info,
  Building2,
  Scale,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { determineLMNPStatus } from "@/lib/services/rental-calculator";

// ============================================
// Types
// ============================================

interface LMNPStatusAlertProps {
  /** Revenus locatifs meublés annuels */
  furnishedRentalIncome: number;
  /** Autres revenus professionnels annuels */
  otherProfessionalIncome: number;
  /** Mode compact pour les dashboards */
  compact?: boolean;
  /** Callback en cas de changement de statut détecté */
  onStatusChange?: (status: "lmnp" | "lmp") => void;
}

// ============================================
// Seuils
// ============================================

const LMP_THRESHOLD = 23000;
const MICRO_BIC_THRESHOLD = 77700;

// ============================================
// Component
// ============================================

export function LMNPStatusAlert({
  furnishedRentalIncome,
  otherProfessionalIncome,
  compact = false,
  onStatusChange,
}: LMNPStatusAlertProps) {
  const statusResult = useMemo(() => {
    const result = determineLMNPStatus({
      furnishedRentalIncome,
      otherProfessionalIncome,
    });
    onStatusChange?.(result.status);
    return result;
  }, [furnishedRentalIncome, otherProfessionalIncome, onStatusChange]);

  // Calcul des seuils pour les barres de progression
  const incomeProgress = Math.min(100, (furnishedRentalIncome / LMP_THRESHOLD) * 100);
  const microBICProgress = Math.min(100, (furnishedRentalIncome / MICRO_BIC_THRESHOLD) * 100);
  const totalIncome = furnishedRentalIncome + otherProfessionalIncome;
  const incomeSharePercent = totalIncome > 0
    ? Math.round((furnishedRentalIncome / totalIncome) * 100)
    : 0;

  if (furnishedRentalIncome <= 0) return null;

  // Mode compact (pour sidebar/dashboard)
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
          statusResult.status === "lmp"
            ? "bg-amber-50 border border-amber-200 text-amber-800"
            : "bg-blue-50 border border-blue-200 text-blue-800"
        )}
      >
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold",
            statusResult.status === "lmp"
              ? "bg-amber-100 text-amber-700 border-amber-300"
              : "bg-blue-100 text-blue-700 border-blue-300"
          )}
        >
          {statusResult.status.toUpperCase()}
        </Badge>
        <span className="truncate">
          {furnishedRentalIncome.toLocaleString("fr-FR")} €/an
        </span>
        {statusResult.incomeThresholdMet && !statusResult.majorityThresholdMet && (
          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
        )}
      </div>
    );
  }

  // Mode complet
  return (
    <Card
      className={cn(
        "overflow-hidden",
        statusResult.status === "lmp"
          ? "border-amber-300"
          : "border-blue-200"
      )}
    >
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-600" />
            <h4 className="font-semibold text-sm">Statut fiscal meublé</h4>
          </div>
          <Badge
            className={cn(
              "text-xs font-bold",
              statusResult.status === "lmp"
                ? "bg-amber-100 text-amber-700 border-amber-300"
                : "bg-blue-100 text-blue-700 border-blue-300"
            )}
          >
            {statusResult.status === "lmp"
              ? "LMP — Loueur Meublé Professionnel"
              : "LMNP — Loueur Meublé Non Professionnel"}
          </Badge>
        </div>

        {/* Critère 1 : Seuil 23 000 € */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              {statusResult.incomeThresholdMet ? (
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              )}
              Seuil recettes : {furnishedRentalIncome.toLocaleString("fr-FR")} € / {LMP_THRESHOLD.toLocaleString("fr-FR")} €
            </span>
            <span
              className={cn(
                "font-medium",
                statusResult.incomeThresholdMet ? "text-amber-600" : "text-green-600"
              )}
            >
              {Math.round(incomeProgress)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                incomeProgress >= 100
                  ? "bg-amber-500"
                  : incomeProgress >= 80
                  ? "bg-amber-300"
                  : "bg-green-400"
              )}
              style={{ width: `${incomeProgress}%` }}
            />
          </div>
        </div>

        {/* Critère 2 : > 50% des revenus pro */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              {statusResult.majorityThresholdMet ? (
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              )}
              Part dans revenus pro : {incomeSharePercent}% / 50%
            </span>
            <span
              className={cn(
                "font-medium",
                statusResult.majorityThresholdMet ? "text-amber-600" : "text-green-600"
              )}
            >
              {statusResult.majorityThresholdMet ? "Dépassé" : "OK"}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                incomeSharePercent >= 50
                  ? "bg-amber-500"
                  : incomeSharePercent >= 40
                  ? "bg-amber-300"
                  : "bg-green-400"
              )}
              style={{ width: `${Math.min(100, incomeSharePercent * 2)}%` }}
            />
          </div>
        </div>

        {/* Seuil micro-BIC */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <Scale className="h-3 w-3 text-slate-400" />
              Plafond micro-BIC : {furnishedRentalIncome.toLocaleString("fr-FR")} € / {MICRO_BIC_THRESHOLD.toLocaleString("fr-FR")} €
            </span>
            <span
              className={cn(
                "font-medium",
                microBICProgress >= 100 ? "text-red-600" : "text-blue-600"
              )}
            >
              {Math.round(microBICProgress)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                microBICProgress >= 100
                  ? "bg-red-500"
                  : microBICProgress >= 80
                  ? "bg-amber-400"
                  : "bg-blue-400"
              )}
              style={{ width: `${microBICProgress}%` }}
            />
          </div>
          {microBICProgress >= 100 && (
            <p className="text-[10px] text-red-600">
              Plafond dépassé — régime réel BIC obligatoire
            </p>
          )}
        </div>

        {/* Explications */}
        <div className="p-3 rounded-lg bg-slate-50 border">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-600">
              {statusResult.reason}
            </p>
          </div>
        </div>

        {/* Impact LMP */}
        {statusResult.status === "lmp" && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs font-medium text-amber-800 mb-2">
              Obligations LMP :
            </p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc ml-4">
              <li>Cotisations sociales SSI (~22-45% des bénéfices)</li>
              <li>CFE (Cotisation Foncière des Entreprises)</li>
              <li>Déficits imputables sur le revenu global</li>
              <li>Plus-values professionnelles (exonération possible après 5 ans)</li>
              <li>IFI : exonération possible si activité principale</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
