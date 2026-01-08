"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  FileText,
  Scale,
  Percent,
  Info,
  AlertCircle,
  Home,
  Bed,
  Check,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Types
export interface ColocationConfigData {
  nbPlaces: number;
  bailType: "unique" | "individuel";
  solidarite: boolean;
  solidariteDurationMonths: number;
  splitMode: "equal" | "custom" | "by_room";
}

interface Property {
  id: string;
  nb_chambres?: number;
  nb_pieces?: number;
  type?: string;
}

interface ColocationConfigProps {
  property: Property | null;
  config: ColocationConfigData;
  onConfigChange: (config: ColocationConfigData) => void;
}

// Configuration par défaut
export const DEFAULT_COLOCATION_CONFIG: ColocationConfigData = {
  nbPlaces: 2,
  bailType: "unique",
  solidarite: true,
  solidariteDurationMonths: 6,
  splitMode: "equal",
};

export function ColocationConfig({
  property,
  config,
  onConfigChange,
}: ColocationConfigProps) {
  // Détecter le nombre de chambres depuis le bien
  const detectedRooms = property?.nb_chambres || property?.nb_pieces || 0;
  
  // Initialiser avec le nombre de chambres détecté
  useEffect(() => {
    if (detectedRooms > 0 && config.nbPlaces === DEFAULT_COLOCATION_CONFIG.nbPlaces) {
      onConfigChange({ ...config, nbPlaces: detectedRooms });
    }
  }, [detectedRooms]);

  const updateConfig = (updates: Partial<ColocationConfigData>) => {
    onConfigChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-600" />
          Configuration de la colocation
        </h3>
        <Badge variant="secondary" className="gap-1 bg-violet-100 text-violet-700">
          <Scale className="h-3 w-3" />
          Conforme loi ALUR
        </Badge>
      </div>

      {/* Nombre de places */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/50"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-lg">
              <Bed className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <Label className="text-base font-medium">
                Nombre de places disponibles
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {detectedRooms > 0 ? (
                  <>
                    Détecté depuis le bien : <strong>{detectedRooms} chambres</strong>
                  </>
                ) : (
                  "Indiquez le nombre maximum de colocataires"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={2}
              max={10}
              value={config.nbPlaces}
              onChange={(e) => updateConfig({ nbPlaces: parseInt(e.target.value) || 2 })}
              className="w-20 text-center font-bold text-lg"
            />
            <span className="text-muted-foreground">places</span>
          </div>
        </div>
      </motion.div>

      {/* Type de bail */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <Label className="text-base font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Type de bail colocation
        </Label>
        
        <RadioGroup
          value={config.bailType}
          onValueChange={(value: "unique" | "individuel") => 
            updateConfig({ bailType: value })
          }
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Bail unique */}
          <label
            className={cn(
              "relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all",
              config.bailType === "unique"
                ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/30"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
            )}
          >
            <RadioGroupItem value="unique" className="absolute top-4 right-4" />
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "p-2 rounded-lg",
                config.bailType === "unique" ? "bg-violet-100" : "bg-slate-100"
              )}>
                <FileText className={cn(
                  "h-5 w-5",
                  config.bailType === "unique" ? "text-violet-600" : "text-slate-600"
                )} />
              </div>
              <span className="font-semibold">Bail unique</span>
              <Badge variant="secondary" className="text-[10px]">Recommandé</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Tous les colocataires signent le même contrat. 
              Gestion simplifiée avec clause de solidarité optionnelle.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="text-xs">1 seul contrat</Badge>
              <Badge variant="outline" className="text-xs">Solidarité possible</Badge>
            </div>
          </label>

          {/* Baux individuels */}
          <label
            className={cn(
              "relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all",
              config.bailType === "individuel"
                ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/30"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
            )}
          >
            <RadioGroupItem value="individuel" className="absolute top-4 right-4" />
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "p-2 rounded-lg",
                config.bailType === "individuel" ? "bg-violet-100" : "bg-slate-100"
              )}>
                <Home className={cn(
                  "h-5 w-5",
                  config.bailType === "individuel" ? "text-violet-600" : "text-slate-600"
                )} />
              </div>
              <span className="font-semibold">Baux individuels</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Chaque colocataire a son propre contrat pour sa chambre. 
              Plus de flexibilité, pas de solidarité.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="text-xs">1 contrat/chambre</Badge>
              <Badge variant="outline" className="text-xs">Indépendance</Badge>
            </div>
          </label>
        </RadioGroup>
      </motion.div>

      {/* Clause de solidarité (uniquement pour bail unique) */}
      {config.bailType === "unique" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <Scale className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium">
                    Clause de solidarité
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          La clause de solidarité permet au propriétaire de réclamer 
                          la totalité du loyer à n'importe quel colocataire en cas d'impayé.
                          <br /><br />
                          <strong>Loi ALUR</strong> : La solidarité prend fin au plus tard 
                          6 mois après le départ d'un colocataire.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Chaque colocataire est responsable de l'intégralité du loyer
                </p>
              </div>
            </div>
            <Switch
              checked={config.solidarite}
              onCheckedChange={(checked) => updateConfig({ solidarite: checked })}
            />
          </div>

          {/* Durée de la solidarité */}
          {config.solidarite && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 pt-4 border-t border-amber-200/50"
            >
              <div className="flex items-center justify-between">
                <Label className="text-sm">
                  Durée après départ d'un colocataire
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    value={config.solidariteDurationMonths}
                    onChange={(e) => updateConfig({ 
                      solidariteDurationMonths: Math.min(6, parseInt(e.target.value) || 1) 
                    })}
                    className="w-16 text-center"
                  />
                  <span className="text-sm text-muted-foreground">mois</span>
                </div>
              </div>
              {config.solidariteDurationMonths > 6 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Maximum légal : 6 mois (loi ALUR)
                </p>
              )}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Mode de répartition */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <Label className="text-base font-medium flex items-center gap-2">
          <Percent className="h-4 w-4 text-muted-foreground" />
          Répartition du loyer
        </Label>

        <RadioGroup
          value={config.splitMode}
          onValueChange={(value: "equal" | "custom" | "by_room") => 
            updateConfig({ splitMode: value })
          }
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {/* Parts égales */}
          <label
            className={cn(
              "relative flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all",
              config.splitMode === "equal"
                ? "border-emerald-500 bg-emerald-50/50"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <RadioGroupItem value="equal" className="absolute top-3 right-3 h-4 w-4" />
            <span className="font-medium text-sm">Parts égales</span>
            <span className="text-xs text-muted-foreground mt-1">
              {config.nbPlaces > 0 
                ? `${(100 / config.nbPlaces).toFixed(1)}% chacun`
                : "Répartition équitable"
              }
            </span>
          </label>

          {/* Par chambre */}
          <label
            className={cn(
              "relative flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all",
              config.splitMode === "by_room"
                ? "border-emerald-500 bg-emerald-50/50"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <RadioGroupItem value="by_room" className="absolute top-3 right-3 h-4 w-4" />
            <span className="font-medium text-sm">Par chambre</span>
            <span className="text-xs text-muted-foreground mt-1">
              Au prorata de la surface
            </span>
          </label>

          {/* Personnalisé */}
          <label
            className={cn(
              "relative flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all",
              config.splitMode === "custom"
                ? "border-emerald-500 bg-emerald-50/50"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <RadioGroupItem value="custom" className="absolute top-3 right-3 h-4 w-4" />
            <span className="font-medium text-sm">Personnalisé</span>
            <span className="text-xs text-muted-foreground mt-1">
              Définir manuellement
            </span>
          </label>
        </RadioGroup>
      </motion.div>

      {/* Récapitulatif */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800"
      >
        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          Récapitulatif configuration
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Places</span>
            <p className="font-semibold">{config.nbPlaces} colocataires</p>
          </div>
          <div>
            <span className="text-muted-foreground">Type</span>
            <p className="font-semibold">
              {config.bailType === "unique" ? "Bail unique" : "Baux individuels"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Solidarité</span>
            <p className="font-semibold">
              {config.bailType === "unique" 
                ? (config.solidarite ? `Oui (${config.solidariteDurationMonths} mois)` : "Non")
                : "N/A"
              }
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Répartition</span>
            <p className="font-semibold">
              {config.splitMode === "equal" ? "Égale" : 
               config.splitMode === "by_room" ? "Par chambre" : "Personnalisée"}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

