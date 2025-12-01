"use client";

/**
 * Écran 2: État des lieux de sortie simplifié
 * Interface mobile-first avec 10 photos max
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Upload,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  InspectionCategory,
  InspectionStatus,
  INSPECTION_CATEGORIES,
} from "@/lib/types/end-of-lease";

interface InspectionItem {
  category: InspectionCategory;
  label: string;
  icon: string;
  description: string;
  status: InspectionStatus;
  photos: string[];
  problemDescription?: string;
}

interface EDLSortieInspectionProps {
  processId: string;
  inspectionItems: InspectionItem[];
  onItemUpdate: (category: InspectionCategory, data: Partial<InspectionItem>) => void;
  onComplete: () => void;
  onBack: () => void;
  className?: string;
}

const CATEGORIES: Array<{
  id: InspectionCategory;
  label: string;
  icon: string;
  description: string;
}> = [
  { id: "murs", label: "Murs", icon: "🧱", description: "Peinture, papier peint, trous" },
  { id: "sols", label: "Sols", icon: "🪵", description: "Parquet, carrelage, moquette" },
  { id: "salle_de_bain", label: "Salle de bain", icon: "🚿", description: "Sanitaires, joints, robinetterie" },
  { id: "cuisine", label: "Cuisine", icon: "🍳", description: "Équipements, plan de travail" },
  { id: "fenetres_portes", label: "Fenêtres & Portes", icon: "🚪", description: "Menuiseries, serrures, vitres" },
  { id: "electricite_plomberie", label: "Électricité & Plomberie", icon: "⚡", description: "Prises, robinets" },
  { id: "meubles", label: "Meubles", icon: "🪑", description: "Mobilier (si meublé)" },
];

export function EDLSortieInspection({
  processId,
  inspectionItems,
  onItemUpdate,
  onComplete,
  onBack,
  className,
}: EDLSortieInspectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showProblemInput, setShowProblemInput] = useState(false);
  const [problemDescription, setProblemDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtrer les catégories présentes dans les items
  const activeCategories = CATEGORIES.filter((cat) =>
    inspectionItems.some((item) => item.category === cat.id)
  );

  const currentCategory = activeCategories[currentIndex];
  const currentItem = inspectionItems.find((item) => item.category === currentCategory?.id);

  // Calculer la progression
  const completedItems = inspectionItems.filter((item) => item.status !== "pending").length;
  const progress = (completedItems / inspectionItems.length) * 100;

  // Naviguer entre les catégories
  const goNext = () => {
    if (currentIndex < activeCategories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowProblemInput(false);
      setProblemDescription("");
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowProblemInput(false);
      setProblemDescription("");
    }
  };

  // Marquer comme OK
  const markAsOk = () => {
    if (currentCategory) {
      onItemUpdate(currentCategory.id, {
        status: "ok",
        problemDescription: undefined,
      });
      goNext();
    }
  };

  // Marquer comme problème
  const markAsProblem = () => {
    setShowProblemInput(true);
  };

  const confirmProblem = () => {
    if (currentCategory) {
      onItemUpdate(currentCategory.id, {
        status: "problem",
        problemDescription: problemDescription,
      });
      setShowProblemInput(false);
      setProblemDescription("");
      goNext();
    }
  };

  // Gérer l'upload de photos
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && currentCategory && currentItem) {
      // Limiter à 2 photos par catégorie (10 max total / 5-7 catégories)
      const currentPhotos = currentItem.photos || [];
      if (currentPhotos.length >= 2) {
        alert("Maximum 2 photos par catégorie");
        return;
      }

      // Créer des URLs pour les photos (dans la vraie app, uploader vers Supabase Storage)
      const newPhotos = Array.from(files).slice(0, 2 - currentPhotos.length).map((file) =>
        URL.createObjectURL(file)
      );

      onItemUpdate(currentCategory.id, {
        photos: [...currentPhotos, ...newPhotos],
      });
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Supprimer une photo
  const removePhoto = (index: number) => {
    if (currentCategory && currentItem) {
      const newPhotos = [...(currentItem.photos || [])];
      newPhotos.splice(index, 1);
      onItemUpdate(currentCategory.id, { photos: newPhotos });
    }
  };

  // Vérifier si on peut terminer
  const canComplete = inspectionItems.every((item) => item.status !== "pending");

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header avec progression */}
      <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white pb-6">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white hover:bg-white/20"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            {currentIndex + 1}/{activeCategories.length}
          </Badge>
        </div>

        <CardTitle className="text-xl flex items-center gap-2">
          <Camera className="w-6 h-6" />
          État des lieux de sortie
        </CardTitle>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm text-white/80">
            <span>Progression</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-white/30" />
        </div>

        {/* Mini navigation */}
        <div className="flex gap-1 mt-4">
          {activeCategories.map((cat, idx) => {
            const item = inspectionItems.find((i) => i.category === cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "flex-1 h-1.5 rounded-full transition-colors",
                  idx === currentIndex && "bg-white",
                  idx !== currentIndex && item?.status === "ok" && "bg-green-400",
                  idx !== currentIndex && item?.status === "problem" && "bg-red-400",
                  idx !== currentIndex && item?.status === "pending" && "bg-white/30"
                )}
              />
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <AnimatePresence mode="wait">
          {currentCategory && (
            <motion.div
              key={currentCategory.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              {/* Catégorie actuelle */}
              <div className="text-center mb-6">
                <span className="text-5xl mb-3 block">{currentCategory.icon}</span>
                <h3 className="text-xl font-semibold">{currentCategory.label}</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {currentCategory.description}
                </p>
              </div>

              {/* Photos */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Photos ({currentItem?.photos?.length || 0}/2)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={(currentItem?.photos?.length || 0) >= 2}
                  >
                    <Camera className="w-4 h-4 mr-1" />
                    Ajouter
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(currentItem?.photos || []).map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-video rounded-lg overflow-hidden bg-muted group"
                    >
                      <img
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {(currentItem?.photos?.length || 0) < 2 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Upload className="w-6 h-6 mb-1" />
                      <span className="text-xs">Photo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Zone de description du problème */}
              <AnimatePresence>
                {showProblemInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 overflow-hidden"
                  >
                    <Textarea
                      placeholder="Décrivez le problème constaté..."
                      value={problemDescription}
                      onChange={(e) => setProblemDescription(e.target.value)}
                      className="mb-3"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={confirmProblem}
                        className="flex-1 bg-red-500 hover:bg-red-600"
                      >
                        Confirmer le problème
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowProblemInput(false);
                          setProblemDescription("");
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Boutons de décision */}
              {!showProblemInput && (
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={markAsProblem}
                    className="h-20 flex-col gap-2 border-red-200 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <X className="w-8 h-8 text-red-500" />
                    <span>Problème</span>
                  </Button>

                  <Button
                    size="lg"
                    onClick={markAsOk}
                    className="h-20 flex-col gap-2 bg-green-500 hover:bg-green-600"
                  >
                    <Check className="w-8 h-8" />
                    <span>Bon état</span>
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation et complétion */}
        <div className="p-4 bg-muted/30 border-t">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Précédent
            </Button>

            {currentIndex === activeCategories.length - 1 ? (
              <Button
                onClick={onComplete}
                disabled={!canComplete}
                className="bg-primary"
              >
                Terminer l'EDL
                <CheckCircle2 className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button variant="ghost" onClick={goNext}>
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

