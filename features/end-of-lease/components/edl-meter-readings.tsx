"use client";

/**
 * Composant pour les relevés de compteurs dans l'EDL
 * 
 * Workflow:
 * 1. Affiche la liste des compteurs à relever
 * 2. L'utilisateur prend une photo du compteur
 * 3. L'OCR analyse automatiquement la photo
 * 4. L'utilisateur peut corriger si nécessaire
 * 5. Validation des deux parties requise
 */

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Edit2,
  Trash2,
  Eye,
  Zap,
  Flame,
  Droplet,
  RefreshCw,
  ChevronRight,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type {
  MeterType,
  MeterInfo,
  EDLMeterReading,
  OCR_CONFIDENCE_THRESHOLDS,
} from "@/lib/types/edl-meters";

// ============================================
// TYPES & INTERFACES
// ============================================

interface MeterReadingItem extends MeterInfo {
  reading?: EDLMeterReading | null;
}

interface EDLMeterReadingsProps {
  edlId: string;
  edlType: "entree" | "sortie";
  meters: MeterInfo[];
  existingReadings: EDLMeterReading[];
  onComplete: () => void;
  onBack: () => void;
  canEdit?: boolean;
  className?: string;
}

interface OCRResult {
  detected_value: number | null;
  confidence: number;
  needs_validation: boolean;
  raw_text: string;
  processing_time_ms: number;
}

// ============================================
// CONSTANTES
// ============================================

const METER_ICONS: Record<MeterType, typeof Zap> = {
  electricity: Zap,
  gas: Flame,
  water: Droplet,
};

const METER_COLORS: Record<MeterType, string> = {
  electricity: "text-yellow-500 bg-yellow-50 border-yellow-200",
  gas: "text-orange-500 bg-orange-50 border-orange-200",
  water: "text-blue-500 bg-blue-50 border-blue-200",
};

const METER_LABELS: Record<MeterType, string> = {
  electricity: "Électricité",
  gas: "Gaz",
  water: "Eau",
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function EDLMeterReadings({
  edlId,
  edlType,
  meters,
  existingReadings,
  onComplete,
  onBack,
  canEdit = true,
  className,
}: EDLMeterReadingsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // État local
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<MeterInfo | null>(null);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState<string>("");
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [readings, setReadings] = useState<Map<string, EDLMeterReading>>(
    new Map(existingReadings.map((r) => [r.meter_id, r]))
  );
  const [editingReading, setEditingReading] = useState<EDLMeterReading | null>(null);

  // Combiner meters avec leurs readings existants
  const metersWithReadings: MeterReadingItem[] = meters.map((meter) => ({
    ...meter,
    reading: readings.get(meter.id) || null,
  }));

  // Calculer la progression
  const completedCount = metersWithReadings.filter((m) => m.reading !== null).length;
  const progress = meters.length > 0 ? (completedCount / meters.length) * 100 : 0;
  const allComplete = completedCount === meters.length;

  // ============================================
  // HANDLERS
  // ============================================

  const handleSelectMeter = (meter: MeterInfo) => {
    if (!canEdit) return;
    
    setSelectedMeter(meter);
    setManualValue("");
    setOcrResult(null);
    setPreviewImage(null);
    setShowPhotoDialog(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMeter) return;

    // Prévisualisation
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload et OCR
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("meter_id", selectedMeter.id);
      formData.append("photo", file);
      if (manualValue) {
        formData.append("manual_value", manualValue);
      }

      const response = await fetch(`/api/edl/${edlId}/meter-readings`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Si OCR a échoué mais photo uploadée, afficher le dialog de saisie manuelle
        if (response.status === 422 && data.photo_path) {
          setOcrResult(data.ocr);
          toast({
            title: "Saisie manuelle requise",
            description: "La valeur n'a pas pu être lue automatiquement.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error || "Erreur lors de l'upload");
      }

      // Succès
      setOcrResult(data.ocr);
      setReadings((prev) => new Map(prev).set(selectedMeter.id, data.reading));
      
      toast({
        title: "Relevé enregistré",
        description: `Valeur: ${data.reading.reading_value} ${selectedMeter.unit}`,
      });

      // Fermer si confiance élevée, sinon proposer validation
      if (data.ocr.confidence >= 80) {
        setShowPhotoDialog(false);
        setSelectedMeter(null);
      }

    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleManualSubmit = async () => {
    if (!selectedMeter || !manualValue || !previewImage) return;

    setIsUploading(true);
    try {
      // Convertir l'image base64 en File
      const response = await fetch(previewImage);
      const blob = await response.blob();
      const file = new File([blob], "meter_photo.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("meter_id", selectedMeter.id);
      formData.append("photo", file);
      formData.append("manual_value", manualValue);

      const apiResponse = await fetch(`/api/edl/${edlId}/meter-readings`, {
        method: "POST",
        body: formData,
      });

      const data = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }

      setReadings((prev) => new Map(prev).set(selectedMeter.id, data.reading));
      
      toast({
        title: "Relevé enregistré",
        description: `Valeur: ${data.reading.reading_value} ${selectedMeter.unit}`,
      });

      setShowPhotoDialog(false);
      setSelectedMeter(null);
      setManualValue("");
      setPreviewImage(null);

    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditReading = (reading: EDLMeterReading, meter: MeterInfo) => {
    if (!canEdit) return;
    setEditingReading(reading);
    setManualValue(reading.reading_value.toString());
    setSelectedMeter(meter);
    setShowValidationDialog(true);
  };

  const handleValidateReading = async () => {
    if (!editingReading || !manualValue) return;

    setIsUploading(true);
    try {
      const response = await fetch(
        `/api/edl/${edlId}/meter-readings/${editingReading.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            corrected_value: parseFloat(manualValue),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la validation");
      }

      setReadings((prev) => new Map(prev).set(editingReading.meter_id, data.reading));
      
      toast({
        title: "Relevé validé",
        description: "La valeur a été corrigée et validée.",
      });

      setShowValidationDialog(false);
      setEditingReading(null);
      setManualValue("");

    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteReading = async (reading: EDLMeterReading) => {
    if (!confirm("Supprimer ce relevé ?")) return;

    try {
      const response = await fetch(
        `/api/edl/${edlId}/meter-readings/${reading.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      setReadings((prev) => {
        const newMap = new Map(prev);
        newMap.delete(reading.meter_id);
        return newMap;
      });

      toast({
        title: "Relevé supprimé",
      });

    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white pb-6">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white hover:bg-white/20"
          >
            ← Retour
          </Button>
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            {completedCount}/{meters.length}
          </Badge>
        </div>

        <CardTitle className="text-xl flex items-center gap-2">
          <Zap className="w-6 h-6" />
          Relevés de compteurs
        </CardTitle>
        <CardDescription className="text-white/80">
          État des lieux {edlType === "entree" ? "d'entrée" : "de sortie"}
        </CardDescription>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm text-white/80">
            <span>Progression</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-white/30" />
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Alerte légale */}
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Obligation légale</AlertTitle>
          <AlertDescription className="text-amber-700 text-sm">
            Les relevés de compteurs doivent figurer dans l'état des lieux 
            (décret n°2016-382 du 30 mars 2016). La photo sert de preuve juridique.
          </AlertDescription>
        </Alert>

        {/* Liste des compteurs */}
        <div className="space-y-3">
          {metersWithReadings.map((meter) => {
            const Icon = METER_ICONS[meter.type];
            const hasReading = meter.reading !== null;
            const needsValidation = hasReading && !meter.reading?.is_validated;

            return (
              <motion.div
                key={meter.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "border rounded-lg p-4 transition-all",
                  hasReading
                    ? needsValidation
                      ? "border-amber-300 bg-amber-50/50"
                      : "border-green-300 bg-green-50/50"
                    : "border-gray-200 hover:border-gray-300 cursor-pointer",
                  METER_COLORS[meter.type]
                )}
                onClick={() => !hasReading && handleSelectMeter(meter)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      hasReading ? "bg-green-100" : "bg-gray-100"
                    )}>
                      <Icon className={cn(
                        "w-6 h-6",
                        hasReading ? "text-green-600" : "text-gray-400"
                      )} />
                    </div>
                    <div>
                      <h4 className="font-medium">{METER_LABELS[meter.type]}</h4>
                      <p className="text-sm text-muted-foreground">
                        {meter.meter_number || "N° non renseigné"}
                        {meter.location && ` • ${meter.location}`}
                      </p>
                    </div>
                  </div>

                  {hasReading ? (
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">
                          {meter.reading?.reading_value.toLocaleString("fr-FR")}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {meter.reading?.reading_unit}
                        </span>
                        {meter.reading?.is_validated ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-500" />
                        )}
                      </div>
                      {meter.reading?.ocr_confidence && (
                        <p className="text-xs text-muted-foreground mt-1">
                          OCR: {meter.reading.ocr_confidence.toFixed(0)}% confiance
                        </p>
                      )}
                      {canEdit && (
                        <div className="flex gap-1 mt-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditReading(meter.reading!, meter);
                            }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteReading(meter.reading!);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" disabled={!canEdit}>
                      <Camera className="w-4 h-4 mr-1" />
                      Relever
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bouton de complétion */}
        <div className="pt-4 border-t">
          <Button
            onClick={onComplete}
            disabled={!allComplete}
            className="w-full"
            size="lg"
          >
            {allComplete ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Continuer vers la signature
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 mr-2" />
                {meters.length - completedCount} compteur(s) restant(s)
              </>
            )}
          </Button>
        </div>
      </CardContent>

      {/* Dialog prise de photo */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMeter && (
                <>
                  {(() => {
                    const Icon = METER_ICONS[selectedMeter.type];
                    return <Icon className="w-5 h-5" />;
                  })()}
                  {METER_LABELS[selectedMeter.type]}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Zone de prévisualisation/upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors",
                previewImage
                  ? "border-green-300 bg-green-50"
                  : "border-gray-300 hover:border-gray-400"
              )}
            >
              {previewImage ? (
                <>
                  <img
                    src={previewImage}
                    alt="Photo du compteur"
                    className="w-full h-full object-contain rounded-lg"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImage(null);
                      setOcrResult(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <ImagePlus className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    Prendre une photo du compteur
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    La valeur sera lue automatiquement
                  </p>
                </>
              )}

              {isUploading && (
                <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-lg">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                  <p className="text-sm">Analyse en cours...</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Résultat OCR */}
            {ocrResult && (
              <Alert className={cn(
                ocrResult.confidence >= 80
                  ? "border-green-200 bg-green-50"
                  : ocrResult.confidence >= 60
                    ? "border-amber-200 bg-amber-50"
                    : "border-red-200 bg-red-50"
              )}>
                <AlertDescription className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      Valeur détectée: {ocrResult.detected_value?.toLocaleString("fr-FR") ?? "—"}
                    </span>
                    <Badge variant={ocrResult.confidence >= 80 ? "default" : "secondary"}>
                      {ocrResult.confidence.toFixed(0)}%
                    </Badge>
                  </div>
                  {ocrResult.needs_validation && (
                    <p className="text-sm text-amber-700">
                      ⚠️ Vérifiez et corrigez la valeur si nécessaire
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Saisie manuelle */}
            <div className="space-y-2">
              <Label htmlFor="manual-value">
                Valeur {ocrResult ? "(correction)" : "(manuelle)"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="manual-value"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 12456"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                />
                <span className="flex items-center text-sm text-muted-foreground">
                  {selectedMeter?.unit}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPhotoDialog(false);
                setSelectedMeter(null);
                setPreviewImage(null);
                setOcrResult(null);
                setManualValue("");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleManualSubmit}
              disabled={!previewImage || !manualValue || isUploading}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de validation/correction */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Valider le relevé</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {editingReading && (
              <>
                <div className="text-sm text-muted-foreground">
                  <p>Valeur OCR: {editingReading.ocr_value?.toLocaleString("fr-FR") ?? "—"}</p>
                  <p>Valeur actuelle: {editingReading.reading_value.toLocaleString("fr-FR")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="corrected-value">Valeur corrigée</Label>
                  <Input
                    id="corrected-value"
                    type="number"
                    step="0.01"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowValidationDialog(false);
                setEditingReading(null);
                setManualValue("");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleValidateReading}
              disabled={!manualValue || isUploading}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

