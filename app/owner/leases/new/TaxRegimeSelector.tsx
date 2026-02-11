"use client";

import { useMemo } from "react";
import {
  Calculator,
  Info,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

export type BICRegime = "micro_bic" | "reel_bic";
export type LMNPStatus = "lmnp" | "lmp";

export interface TaxRegimeData {
  regime: BICRegime;
  lmnpStatus: LMNPStatus;
}

interface TaxRegimeSelectorProps {
  value: TaxRegimeData;
  onChange: (data: TaxRegimeData) => void;
  annualRent: number;
}

// ============================================
// Constants
// ============================================

const MICRO_BIC_THRESHOLD = 77700; // Seuil micro-BIC 2024-2026
const LMP_REVENUE_THRESHOLD = 23000; // Seuil revenu LMP
const MICRO_BIC_ABATEMENT = 0.50; // 50% d'abattement

// ============================================
// Factory
// ============================================

export function createInitialTaxRegime(): TaxRegimeData {
  return {
    regime: "micro_bic",
    lmnpStatus: "lmnp",
  };
}

// ============================================
// Component
// ============================================

export function TaxRegimeSelector({
  value,
  onChange,
  annualRent,
}: TaxRegimeSelectorProps) {
  // Calcul du revenu imposable estimé
  const taxEstimates = useMemo(() => {
    const microBIC = Math.round(annualRent * (1 - MICRO_BIC_ABATEMENT));
    const isAboveThreshold = annualRent > MICRO_BIC_THRESHOLD;
    const isNearLMPThreshold = annualRent > LMP_REVENUE_THRESHOLD * 0.8;

    return {
      microBIC,
      isAboveThreshold,
      isNearLMPThreshold,
      annualRent,
    };
  }, [annualRent]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-blue-600" />
        <h4 className="font-semibold text-sm uppercase text-muted-foreground">
          Régime fiscal BIC (meublé)
        </h4>
      </div>

      {/* Info banner */}
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            Les revenus de location meublée relèvent des{" "}
            <strong>Bénéfices Industriels et Commerciaux (BIC)</strong>, et non
            des revenus fonciers. Choisissez votre régime fiscal.
          </p>
        </div>
      </div>

      {/* Regime selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Micro-BIC */}
        <button
          type="button"
          onClick={() => onChange({ ...value, regime: "micro_bic" })}
          className={cn(
            "text-left p-4 rounded-lg border-2 transition-all",
            value.regime === "micro_bic"
              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
              : "border-slate-200 hover:border-slate-300"
          )}
          disabled={taxEstimates.isAboveThreshold}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Micro-BIC</span>
            {value.regime === "micro_bic" && (
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Abattement forfaitaire de <strong>50%</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Si recettes &lt; {MICRO_BIC_THRESHOLD.toLocaleString("fr-FR")} €/an
          </p>
          {annualRent > 0 && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs">
                Imposable estimé :{" "}
                <strong className="text-blue-700">
                  {taxEstimates.microBIC.toLocaleString("fr-FR")} €
                </strong>
              </p>
            </div>
          )}
          {taxEstimates.isAboveThreshold && (
            <Badge variant="destructive" className="mt-2 text-[10px]">
              Seuil dépassé — régime réel obligatoire
            </Badge>
          )}
        </button>

        {/* Réel BIC */}
        <button
          type="button"
          onClick={() => onChange({ ...value, regime: "reel_bic" })}
          className={cn(
            "text-left p-4 rounded-lg border-2 transition-all",
            value.regime === "reel_bic"
              ? "border-green-500 bg-green-50 ring-1 ring-green-200"
              : "border-slate-200 hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Régime réel BIC</span>
            {value.regime === "reel_bic" && (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Déduction charges <strong>+ amortissement</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Obligatoire si recettes &gt;{" "}
            {MICRO_BIC_THRESHOLD.toLocaleString("fr-FR")} €/an
          </p>
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs text-green-700">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              Permet l'amortissement du bien et du mobilier
            </p>
          </div>
        </button>
      </div>

      {/* LMNP / LMP selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Statut fiscal du bailleur
        </label>
        <Select
          value={value.lmnpStatus}
          onValueChange={(v) =>
            onChange({ ...value, lmnpStatus: v as LMNPStatus })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lmnp">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                >
                  LMNP
                </Badge>
                <span className="text-sm">
                  Loueur Meublé Non Professionnel
                </span>
              </div>
            </SelectItem>
            <SelectItem value="lmp">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                >
                  LMP
                </Badge>
                <span className="text-sm">Loueur Meublé Professionnel</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* LMP threshold warning */}
      {taxEstimates.isNearLMPThreshold && value.lmnpStatus === "lmnp" && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-800">
                Attention : seuil LMP proche
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Le statut LMP s'applique si vos recettes locatives meublées
                dépassent <strong>23 000 €/an</strong> ET représentent plus de
                50% de vos revenus professionnels.
                Revenus estimés :{" "}
                <strong>
                  {taxEstimates.annualRent.toLocaleString("fr-FR")} €/an
                </strong>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* LMP info */}
      {value.lmnpStatus === "lmp" && (
        <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-purple-800">
                Statut LMP : obligations supplémentaires
              </p>
              <ul className="text-xs text-purple-700 mt-1 space-y-1 list-disc ml-3">
                <li>Inscription au RCS ou registre des entreprises</li>
                <li>CFE (Cotisation Foncière des Entreprises) à payer</li>
                <li>
                  Cotisations sociales SSI (ou URSSAF) sur les bénéfices
                </li>
                <li>
                  Déficits imputables sur le revenu global (avantage)
                </li>
                <li>
                  Plus-values professionnelles (exonération possible après 5
                  ans)
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
