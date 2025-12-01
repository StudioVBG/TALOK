"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { TrendingUp, Sparkles, Info, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Prix moyens au m² par département (données indicatives 2024)
// Source : https://www.seloger.com/prix-de-l-immo/location/
const MARKET_PRICES: Record<string, { min: number; max: number; avg: number }> = {
  // Île-de-France
  "75": { min: 25, max: 45, avg: 32 }, // Paris
  "92": { min: 18, max: 30, avg: 23 }, // Hauts-de-Seine
  "93": { min: 14, max: 22, avg: 17 }, // Seine-Saint-Denis
  "94": { min: 15, max: 24, avg: 19 }, // Val-de-Marne
  "77": { min: 11, max: 17, avg: 14 }, // Seine-et-Marne
  "78": { min: 13, max: 21, avg: 16 }, // Yvelines
  "91": { min: 12, max: 19, avg: 15 }, // Essonne
  "95": { min: 12, max: 18, avg: 14 }, // Val-d'Oise
  
  // Grandes métropoles
  "69": { min: 12, max: 18, avg: 14 }, // Rhône (Lyon)
  "13": { min: 11, max: 17, avg: 13 }, // Bouches-du-Rhône (Marseille)
  "06": { min: 14, max: 22, avg: 17 }, // Alpes-Maritimes (Nice)
  "31": { min: 11, max: 16, avg: 13 }, // Haute-Garonne (Toulouse)
  "33": { min: 12, max: 17, avg: 14 }, // Gironde (Bordeaux)
  "44": { min: 11, max: 16, avg: 13 }, // Loire-Atlantique (Nantes)
  "59": { min: 10, max: 15, avg: 12 }, // Nord (Lille)
  "67": { min: 10, max: 15, avg: 12 }, // Bas-Rhin (Strasbourg)
  
  // DROM
  "971": { min: 10, max: 16, avg: 13 }, // Guadeloupe
  "972": { min: 11, max: 17, avg: 14 }, // Martinique
  "973": { min: 9, max: 14, avg: 11 },  // Guyane
  "974": { min: 10, max: 16, avg: 12 }, // Réunion
  "976": { min: 8, max: 14, avg: 10 },  // Mayotte

  // Autres (moyenne France)
  "default": { min: 8, max: 14, avg: 10 },
};

interface RentEstimationProps {
  onApply?: (rent: number) => void;
  compact?: boolean;
}

export function RentEstimation({ onApply, compact = false }: RentEstimationProps) {
  const { formData, updateFormData } = usePropertyWizardStore();

  const estimation = useMemo(() => {
    const surface = (formData.surface_habitable_m2 || formData.surface) as number;
    const codePostal = (formData.code_postal as string) || "";
    
    if (!surface || surface <= 0 || !codePostal || codePostal.length < 2) {
      return null;
    }

    // Déterminer le département
    let deptCode: string;
    if (codePostal.startsWith("97")) {
      deptCode = codePostal.substring(0, 3);
    } else {
      deptCode = codePostal.substring(0, 2);
    }

    const prices = MARKET_PRICES[deptCode] || MARKET_PRICES["default"];

    // Calcul de base
    let baseLow = surface * prices.min;
    let baseHigh = surface * prices.max;
    let baseAvg = surface * prices.avg;

    // Ajustements selon les caractéristiques
    const adjustments: { label: string; factor: number }[] = [];

    // Meublé +10-20%
    if (formData.meuble) {
      const factor = 1.15;
      baseLow *= factor;
      baseHigh *= factor;
      baseAvg *= factor;
      adjustments.push({ label: "Meublé", factor: 15 });
    }

    // Ascenseur +3-5%
    if (formData.ascenseur) {
      const factor = 1.04;
      baseLow *= factor;
      baseHigh *= factor;
      baseAvg *= factor;
      adjustments.push({ label: "Ascenseur", factor: 4 });
    }

    // Étage élevé sans ascenseur -5%
    if (!formData.ascenseur && (formData.etage as number) > 3) {
      const factor = 0.95;
      baseLow *= factor;
      baseHigh *= factor;
      baseAvg *= factor;
      adjustments.push({ label: "Étage élevé sans ascenseur", factor: -5 });
    }

    // Type de bien
    const propertyType = formData.type as string;
    if (propertyType === "studio") {
      const factor = 1.08; // Studios plus chers au m²
      baseLow *= factor;
      baseHigh *= factor;
      baseAvg *= factor;
      adjustments.push({ label: "Studio", factor: 8 });
    } else if (propertyType === "colocation") {
      const factor = 1.05;
      baseLow *= factor;
      baseHigh *= factor;
      baseAvg *= factor;
      adjustments.push({ label: "Colocation", factor: 5 });
    }

    return {
      low: Math.round(baseLow),
      high: Math.round(baseHigh),
      avg: Math.round(baseAvg),
      pricePerM2: prices.avg,
      adjustments,
      deptCode,
    };
  }, [formData]);

  const handleApply = () => {
    if (estimation) {
      updateFormData({ loyer_hc: estimation.avg });
      onApply?.(estimation.avg);
    }
  };

  if (!estimation) {
    return null;
  }

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800"
      >
        <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-emerald-700 dark:text-emerald-300">Estimation</span>
          <span className="font-bold text-emerald-800 dark:text-emerald-200 ml-2">
            {estimation.avg} €/mois
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleApply}
          className="h-6 px-2 text-[10px] text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
        >
          Appliquer
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800 shadow-sm"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">
                Estimation de loyer
              </h4>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                Basée sur les prix du marché
              </p>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-emerald-500 hover:text-emerald-600">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Estimation indicative basée sur les prix moyens au m² dans votre département 
                  ({estimation.pricePerM2} €/m²) et les caractéristiques du bien.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Range */}
        <div className="text-center mb-3">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-sm text-emerald-700 dark:text-emerald-300">{estimation.low} €</span>
            <span className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 mx-2">
              {estimation.avg} €
            </span>
            <span className="text-sm text-emerald-700 dark:text-emerald-300">{estimation.high} €</span>
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">/mois (hors charges)</p>
        </div>

        {/* Visual range bar */}
        <div className="relative h-2 bg-emerald-200 dark:bg-emerald-900 rounded-full mb-3 overflow-hidden">
          <div className="absolute inset-y-0 left-[25%] right-[25%] bg-emerald-400 dark:bg-emerald-600 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 bg-emerald-600 dark:bg-emerald-400 rounded-full border-2 border-white dark:border-emerald-950 shadow-sm" />
        </div>

        {/* Adjustments */}
        {estimation.adjustments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {estimation.adjustments.map((adj, idx) => (
              <span
                key={idx}
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  adj.factor > 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                }`}
              >
                {adj.label} {adj.factor > 0 ? "+" : ""}{adj.factor}%
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleApply}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            size="sm"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Appliquer {estimation.avg} €
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

