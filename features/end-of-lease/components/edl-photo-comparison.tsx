"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  Calendar, 
  ArrowLeftRight,
  Maximize2,
  X,
  AlertTriangle,
  Check,
  Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import Image from "next/image";

export interface ComparisonPhoto {
  id: string;
  url: string;
  taken_at: string;
  room_name?: string;
  item_name?: string;
  condition?: "neuf" | "bon" | "moyen" | "mauvais" | "tres_mauvais";
}

interface EDLPhotoComparisonProps {
  entreePhotos: ComparisonPhoto[];
  sortiePhotos: ComparisonPhoto[];
  roomName: string;
  itemName?: string;
  onAddSortiePhoto?: () => void;
  className?: string;
}

const CONDITION_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  bon: { label: "Bon état", color: "text-green-700", bg: "bg-green-100" },
  moyen: { label: "État moyen", color: "text-amber-700", bg: "bg-amber-100" },
  mauvais: { label: "Mauvais état", color: "text-orange-700", bg: "bg-orange-100" },
  tres_mauvais: { label: "Très mauvais", color: "text-red-700", bg: "bg-red-100" },
};

export function EDLPhotoComparison({
  entreePhotos,
  sortiePhotos,
  roomName,
  itemName,
  onAddSortiePhoto,
  className,
}: EDLPhotoComparisonProps) {
  const [entreeIndex, setEntreeIndex] = useState(0);
  const [sortieIndex, setSortieIndex] = useState(0);
  const [zoomMode, setZoomMode] = useState<"entree" | "sortie" | "compare" | null>(null);
  const [sliderValue, setSliderValue] = useState(50);
  const [isSliding, setIsSliding] = useState(false);

  const hasEntree = entreePhotos.length > 0;
  const hasSortie = sortiePhotos.length > 0;

  const currentEntree = entreePhotos[entreeIndex];
  const currentSortie = sortiePhotos[sortieIndex];

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // Détecter les différences d'état
  const hasConditionChange = currentEntree?.condition && currentSortie?.condition && 
    currentEntree.condition !== currentSortie.condition;

  const conditionDegraded = hasConditionChange && 
    ["mauvais", "tres_mauvais"].includes(currentSortie?.condition || "") &&
    ["bon", "moyen"].includes(currentEntree?.condition || "");

  return (
    <>
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {roomName}
              {itemName && (
                <span className="text-muted-foreground font-normal text-base">
                  — {itemName}
                </span>
              )}
            </CardTitle>
            
            {/* Indicateurs de changement */}
            <div className="flex items-center gap-2">
              {conditionDegraded && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Dégradation
                </Badge>
              )}
              {hasEntree && hasSortie && !hasConditionChange && (
                <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                  <Check className="h-3 w-3" />
                  État préservé
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ========== Colonne ENTRÉE ========== */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge 
                  variant="outline" 
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                >
                  📥 État d'entrée
                </Badge>
                {hasEntree && entreePhotos.length > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEntreeIndex((i) => Math.max(0, i - 1))}
                      disabled={entreeIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground font-medium px-1">
                      {entreeIndex + 1}/{entreePhotos.length}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEntreeIndex((i) => Math.min(entreePhotos.length - 1, i + 1))}
                      disabled={entreeIndex === entreePhotos.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <motion.div
                className={cn(
                  "relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer group",
                  "border-2 transition-all",
                  hasEntree 
                    ? "bg-slate-100 border-slate-200 hover:border-emerald-400" 
                    : "bg-slate-50 border-dashed border-slate-300"
                )}
                onClick={() => hasEntree && setZoomMode("entree")}
                whileHover={{ scale: hasEntree ? 1.01 : 1 }}
              >
                {hasEntree ? (
                  <>
                    <Image
                      src={currentEntree.url}
                      alt={`${roomName} - Entrée`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                    
                    {/* Overlay hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <Button size="sm" variant="secondary" className="shadow">
                          <ZoomIn className="h-4 w-4 mr-1" />
                          Agrandir
                        </Button>
                      </div>
                    </div>

                    {/* Info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="h-3 w-3" />
                          {formatDate(currentEntree.taken_at)}
                        </div>
                        {currentEntree.condition && (
                          <Badge 
                            className={cn(
                              "text-xs",
                              CONDITION_STYLES[currentEntree.condition]?.bg,
                              CONDITION_STYLES[currentEntree.condition]?.color
                            )}
                          >
                            {CONDITION_STYLES[currentEntree.condition]?.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Camera className="h-8 w-8 opacity-40" />
                    <p className="text-sm font-medium">Aucune photo d'entrée</p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* ========== Colonne SORTIE ========== */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge 
                  variant="outline" 
                  className="bg-orange-50 text-orange-700 border-orange-200 font-medium"
                >
                  📤 État de sortie
                </Badge>
                {hasSortie && sortiePhotos.length > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setSortieIndex((i) => Math.max(0, i - 1))}
                      disabled={sortieIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground font-medium px-1">
                      {sortieIndex + 1}/{sortiePhotos.length}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setSortieIndex((i) => Math.min(sortiePhotos.length - 1, i + 1))}
                      disabled={sortieIndex === sortiePhotos.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <motion.div
                className={cn(
                  "relative aspect-[4/3] rounded-xl overflow-hidden group",
                  "border-2 transition-all",
                  hasSortie 
                    ? "bg-slate-100 border-slate-200 hover:border-orange-400 cursor-pointer" 
                    : "bg-slate-50 border-dashed border-slate-300"
                )}
                onClick={() => hasSortie ? setZoomMode("sortie") : onAddSortiePhoto?.()}
                whileHover={{ scale: hasSortie ? 1.01 : 1 }}
              >
                {hasSortie ? (
                  <>
                    <Image
                      src={currentSortie.url}
                      alt={`${roomName} - Sortie`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                    
                    {/* Overlay hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <Button size="sm" variant="secondary" className="shadow">
                          <ZoomIn className="h-4 w-4 mr-1" />
                          Agrandir
                        </Button>
                      </div>
                    </div>

                    {/* Info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="h-3 w-3" />
                          {formatDate(currentSortie.taken_at)}
                        </div>
                        {currentSortie.condition && (
                          <Badge 
                            className={cn(
                              "text-xs",
                              CONDITION_STYLES[currentSortie.condition]?.bg,
                              CONDITION_STYLES[currentSortie.condition]?.color
                            )}
                          >
                            {CONDITION_STYLES[currentSortie.condition]?.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                      <Camera className="h-7 w-7 text-orange-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-600">En attente de sortie</p>
                      {onAddSortiePhoto && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddSortiePhoto();
                          }}
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          Ajouter photo
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Bouton comparaison côte à côte */}
          {hasEntree && hasSortie && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setZoomMode("compare")}
                className="gap-2"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Comparer en superposition
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== Modal Zoom / Comparaison ========== */}
      <Dialog open={!!zoomMode} onOpenChange={() => setZoomMode(null)}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 bg-black/95 border-none">
          <DialogClose className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 rounded-full p-2 transition-colors">
            <X className="h-6 w-6" />
          </DialogClose>

          {/* Header info */}
          <div className="absolute top-4 left-4 z-50 text-white">
            <h3 className="font-semibold text-lg">{roomName}</h3>
            {itemName && <p className="text-white/70 text-sm">{itemName}</p>}
          </div>

          <div className="w-full h-full flex items-center justify-center p-8 pt-16">
            {zoomMode === "compare" && currentEntree && currentSortie ? (
              // Mode comparaison avec slider
              <div className="relative w-full h-full max-w-4xl">
                <div className="relative w-full h-[calc(100%-60px)] overflow-hidden rounded-xl">
                  {/* Image Sortie (dessous) */}
                  <div className="absolute inset-0">
                    <Image
                      src={currentSortie.url}
                      alt="Sortie"
                      fill
                      className="object-contain"
                    />
                  </div>

                  {/* Image Entrée (dessus, clippée) */}
                  <div 
                    className="absolute inset-0"
                    style={{ clipPath: `inset(0 ${100 - sliderValue}% 0 0)` }}
                  >
                    <Image
                      src={currentEntree.url}
                      alt="Entrée"
                      fill
                      className="object-contain"
                    />
                  </div>

                  {/* Ligne de séparation */}
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-lg z-10"
                    style={{ left: `${sliderValue}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                      <ArrowLeftRight className="h-5 w-5 text-slate-600" />
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="absolute top-4 left-4 bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow">
                    Entrée
                  </div>
                  <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow">
                    Sortie
                  </div>
                </div>

                {/* Slider control */}
                <div className="mt-4 px-8">
                  <Slider
                    value={[sliderValue]}
                    onValueChange={([val]) => setSliderValue(val)}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-white/60 text-xs mt-2">
                    <span>← Entrée</span>
                    <span>Sortie →</span>
                  </div>
                </div>
              </div>
            ) : (
              // Mode zoom simple
              <div className="relative w-full h-full">
                <Image
                  src={
                    zoomMode === "entree" 
                      ? currentEntree?.url || "" 
                      : currentSortie?.url || ""
                  }
                  alt="Zoom"
                  fill
                  className="object-contain"
                />

                {/* Badge type */}
                <div className="absolute top-4 right-16">
                  <Badge 
                    className={
                      zoomMode === "entree" 
                        ? "bg-emerald-500 text-white" 
                        : "bg-orange-500 text-white"
                    }
                  >
                    {zoomMode === "entree" ? "📥 Entrée" : "📤 Sortie"}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Tabs switch dans le modal */}
          {hasEntree && hasSortie && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur rounded-full p-1">
              <Button
                size="sm"
                variant={zoomMode === "entree" ? "secondary" : "ghost"}
                onClick={() => setZoomMode("entree")}
                className="text-white rounded-full"
              >
                Entrée
              </Button>
              <Button
                size="sm"
                variant={zoomMode === "compare" ? "secondary" : "ghost"}
                onClick={() => setZoomMode("compare")}
                className="text-white rounded-full"
              >
                <ArrowLeftRight className="h-4 w-4 mr-1" />
                Comparer
              </Button>
              <Button
                size="sm"
                variant={zoomMode === "sortie" ? "secondary" : "ghost"}
                onClick={() => setZoomMode("sortie")}
                className="text-white rounded-full"
              >
                Sortie
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

