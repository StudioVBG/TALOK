"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BuildingUnit } from "@/lib/types/building-v3";

interface BuildingVisualizerProps {
  floors: number;
  /** Lowest floor (negative for basements, e.g. -2). Defaults to 0. */
  minFloor?: number;
  units: BuildingUnit[];
  selectedFloor: number | null;
  onFloorSelect: (floor: number | null) => void;
  onAddUnit: (floor: number) => void;
  className?: string;
}

/**
 * BuildingVisualizer - Visualisation isométrique 3D d'un immeuble
 * 
 * SOTA 2026 :
 * - Vue isométrique stylisée avec perspective
 * - Animation fluide des étages
 * - Code couleur par statut (vacant/occupé/travaux)
 * - Interaction directe pour sélection/ajout
 */
export function BuildingVisualizer({
  floors,
  minFloor = 0,
  units,
  selectedFloor,
  onFloorSelect,
  onAddUnit,
  className,
}: BuildingVisualizerProps) {
  // Derive actual min floor from units if they contain basements
  const effectiveMinFloor = useMemo(() => {
    const unitMinFloor = units.length > 0 ? Math.min(...units.map(u => u.floor)) : 0;
    return Math.min(minFloor, unitMinFloor);
  }, [minFloor, units]);
  
  // Stats globales
  const stats = useMemo(() => {
    const totalUnits = units.filter(u => u.type !== "parking" && u.type !== "cave").length;
    const totalParkings = units.filter(u => u.type === "parking").length;
    const totalSurface = units.reduce((acc, u) => acc + u.surface, 0);
    const occupiedUnits = units.filter(u => u.status === "occupe").length;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    
    return { totalUnits, totalParkings, totalSurface, occupancyRate };
  }, [units]);

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header avec stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-400" />
          <span className="text-white font-semibold">Votre Immeuble</span>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-blue-300 border-blue-500/50 text-xs">
            {floors} étage{floors > 1 ? "s" : ""}
          </Badge>
          <Badge variant="outline" className="text-emerald-300 border-emerald-500/50 text-xs">
            {stats.totalUnits} lot{stats.totalUnits > 1 ? "s" : ""}
          </Badge>
          {stats.occupancyRate > 0 && (
            <Badge variant="outline" className="text-purple-300 border-purple-500/50 text-xs">
              {stats.occupancyRate}% occupé
            </Badge>
          )}
        </div>
      </div>

      {/* Visualisation isométrique */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1 py-4 overflow-y-auto">
        
        {/* Toit */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-xs"
        >
          <div className="h-5 bg-gradient-to-b from-slate-500 to-slate-600 rounded-t-lg transform skew-x-[-3deg] shadow-xl border-t border-slate-400/30" />
        </motion.div>

        {/* Étages (du haut vers le bas, incluant sous-sols) */}
        {Array.from({ length: floors - effectiveMinFloor }, (_, i) => floors - 1 - i).map((floor, idx) => {
          const floorUnits = units.filter(u => u.floor === floor);
          const isSelected = selectedFloor === floor;
          const hasVacant = floorUnits.some(u => u.status === "vacant");
          const hasOccupied = floorUnits.some(u => u.status === "occupe");
          const hasTravaux = floorUnits.some(u => u.status === "travaux");
          
          return (
            <motion.div
              key={floor}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03, type: "spring", stiffness: 100 }}
              onClick={() => onFloorSelect(isSelected ? null : floor)}
              className={cn(
                "w-full max-w-xs cursor-pointer transition-all duration-300 group",
                isSelected && "scale-[1.03] z-10"
              )}
            >
              {/* Label étage - visible au hover ou sélection */}
              <div className={cn(
                "flex items-center justify-between px-2 mb-0.5 transition-opacity",
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}>
                <span className="text-[10px] font-medium text-slate-400">
                  {floor < 0 ? `Sous-sol ${Math.abs(floor)}` : floor === 0 ? "RDC" : `Étage ${floor}`}
                </span>
                <span className="text-[10px] text-slate-500">
                  {floorUnits.length} lot{floorUnits.length !== 1 ? "s" : ""}
                </span>
              </div>
              
              {/* Barre d'étage avec lots */}
              <div className={cn(
                "relative h-10 md:h-12 rounded-sm border-2 transition-all overflow-hidden",
                floor < 0
                  ? "bg-gradient-to-r from-slate-800/90 via-slate-700/70 to-slate-800/90"
                  : "bg-gradient-to-r from-slate-700/80 via-slate-600/60 to-slate-700/80",
                "shadow-sm hover:shadow-md",
                isSelected 
                  ? "border-blue-500 shadow-lg shadow-blue-500/20" 
                  : "border-slate-600/50 hover:border-slate-500"
              )}>
                
                {/* Pattern de fenêtres en arrière-plan */}
                <div className="absolute inset-0 opacity-20">
                  <div className="grid grid-cols-8 gap-1 p-1 h-full">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="bg-slate-500/30 rounded-[2px]" />
                    ))}
                  </div>
                </div>
                
                {/* Lots visibles */}
                <div className="absolute inset-1 flex gap-1 z-10">
                  {floorUnits.length > 0 ? (
                    floorUnits.slice(0, 6).map((unit, unitIdx) => (
                      <motion.div
                        key={unit.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 + unitIdx * 0.05 }}
                        className={cn(
                          "flex-1 min-w-0 rounded-[3px] flex items-center justify-center",
                          "text-[10px] font-semibold tracking-wide",
                          "border backdrop-blur-sm transition-all",
                          unit.status === "occupe" 
                            ? "bg-emerald-500/40 border-emerald-400/60 text-emerald-200"
                            : unit.status === "travaux"
                              ? "bg-amber-500/40 border-amber-400/60 text-amber-200"
                              : unit.status === "reserve"
                                ? "bg-purple-500/40 border-purple-400/60 text-purple-200"
                                : "bg-blue-500/30 border-blue-400/50 text-blue-200"
                        )}
                      >
                        {unit.template?.toUpperCase() || unit.position}
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-[10px]">
                      {isSelected ? "Cliquez + pour ajouter" : "Vide"}
                    </div>
                  )}
                  
                  {/* Indicateur +X si plus de 6 lots */}
                  {floorUnits.length > 6 && (
                    <div className="w-8 rounded-[3px] flex items-center justify-center bg-slate-600/50 text-slate-400 text-[10px]">
                      +{floorUnits.length - 6}
                    </div>
                  )}
                </div>
                
                {/* Bouton + rapide - visible quand sélectionné */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute -right-9 top-1/2 -translate-y-1/2"
                    >
                      <Button 
                        size="icon" 
                        variant="ghost"
                        className="h-7 w-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddUnit(floor);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Indicateurs de statut colorés sur le bord */}
                <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
                  {hasOccupied && <div className="flex-1 bg-emerald-500" />}
                  {hasVacant && <div className="flex-1 bg-blue-500" />}
                  {hasTravaux && <div className="flex-1 bg-amber-500" />}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Sol / Fondations */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-xs"
        >
          <div className="h-3 bg-gradient-to-r from-amber-900/40 via-amber-800/30 to-amber-900/40 rounded-b border-b border-amber-700/30" />
        </motion.div>
      </div>

      {/* Légende */}
      <div className="flex items-center justify-center gap-4 pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-[10px] text-slate-400">Vacant</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-slate-400">Occupé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-[10px] text-slate-400">Travaux</span>
        </div>
      </div>
    </div>
  );
}

