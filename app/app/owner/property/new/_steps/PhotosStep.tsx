"use client";
// @ts-nocheck

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, Image as ImageIcon, Check, AlertCircle } from "lucide-react";
import StepFrame from "../_components/StepFrame";
import WizardFooter from "../_components/WizardFooter";
import { useNewProperty } from "../_store/useNewProperty";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import Image from "next/image";

interface PhotoFile {
  id: string;
  file: File;
  preview: string;
  uploadProgress?: number;
  uploaded?: boolean;
  error?: string;
  isCover?: boolean;
}

const MAX_PHOTOS = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function PhotosStep() {
  const { draft, patch, next, prev } = useNewProperty();
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Initialiser avec les photos existantes du draft
  useState(() => {
    if (draft.photos && Array.isArray(draft.photos)) {
      // Si des photos sont déjà dans le draft, les charger
      // Pour l'instant, on part de zéro
    }
  });

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: PhotoFile[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      // Validation du type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`${file.name} : Format non supporté (JPEG, PNG, WebP uniquement)`);
        return;
      }

      // Validation de la taille
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} : Fichier trop volumineux (max 10MB)`);
        return;
      }

      // Validation du nombre maximum
      if (photos.length + newFiles.length >= MAX_PHOTOS) {
        errors.push(`Limite de ${MAX_PHOTOS} photos atteinte`);
        return;
      }

      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const preview = URL.createObjectURL(file);

      newFiles.push({
        id,
        file,
        preview,
        uploaded: false,
      });
    });

    if (errors.length > 0) {
      toast({
        title: "Erreurs de validation",
        description: errors.join(", "),
        variant: "destructive",
      });
    }

    if (newFiles.length > 0) {
      // La première photo ajoutée devient automatiquement la photo de couverture
      if (photos.length === 0 && newFiles.length > 0) {
        newFiles[0].isCover = true;
      }
      
      setPhotos((prev) => {
        const updated = [...prev, ...newFiles];
        // Sauvegarder dans le store
        patch({
          photos: updated.map((p) => ({
            id: p.id,
            file: p.file,
            preview: p.preview,
            isCover: p.isCover || false,
          })),
        });
        return updated;
      });
    }
  }, [photos, patch, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleRemove = useCallback((id: string) => {
    setPhotos((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      // Nettoyer l'URL de prévisualisation
      const photo = prev.find((p) => p.id === id);
      if (photo?.preview) {
        URL.revokeObjectURL(photo.preview);
      }
      // Mettre à jour le store
      patch({
        photos: updated.map((p) => ({
          id: p.id,
          file: p.file,
          preview: p.preview,
        })),
      });
      return updated;
    });
  }, [patch]);

  const handleSetCover = useCallback((id: string) => {
    setPhotos((prev) => {
      const updated = prev.map((p) => ({
        ...p,
        isCover: p.id === id,
      }));
      patch({
        photos: updated.map((p) => ({
          id: p.id,
          file: p.file,
          preview: p.preview,
          isCover: p.id === id,
        })),
      });
      return updated;
    });
  }, [patch]);

  const canContinue = photos.length >= 1;

  return (
    <StepFrame k="PHOTOS">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Étape — Photos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ajoutez au moins une photo pour illustrer votre bien ({photos.length}/{MAX_PHOTOS})
          </p>
        </div>

        {/* Zone de drop */}
        <motion.div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-8 transition-all",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-border hover:border-primary/50 bg-muted/30",
            "min-h-[200px] flex flex-col items-center justify-center gap-4"
          )}
        >
          <input
            ref={fileInputRef}
            id="property-photos-upload"
            name="property-photos"
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            aria-label="Sélectionner des photos"
          />

          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: reduced ? 0 : 0.3 }}
            className="text-center space-y-3"
          >
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold">
                Glissez-déposez vos photos ici
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ou cliquez pour sélectionner des fichiers
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Formats acceptés : JPEG, PNG, WebP (max 10MB par fichier)
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] min-w-[44px]"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Sélectionner des photos
            </Button>
          </motion.div>
        </motion.div>

        {/* Grille de photos */}
        {photos.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold">
              Photos ajoutées ({photos.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {photos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                    className="relative group"
                  >
                    <Card className="overflow-hidden">
                      <CardContent className="p-0 relative aspect-square">
                        <Image
                          src={photo.preview}
                          alt={`Photo ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                        {/* Overlay avec actions */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            onClick={() => handleSetCover(photo.id)}
                            className="h-8 w-8 rounded-full"
                            aria-label="Définir comme photo de couverture"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            onClick={() => handleRemove(photo.id)}
                            className="h-8 w-8 rounded-full"
                            aria-label="Supprimer la photo"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {/* Badge photo de couverture */}
                        {photo.isCover && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium"
                          >
                            Couverture
                          </motion.div>
                        )}
                        {/* Badge numéro */}
                        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-medium">
                          {index + 1}
                        </div>
                        {/* Barre de progression */}
                        {photo.uploadProgress !== undefined && photo.uploadProgress < 100 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                            <motion.div
                              className="h-full bg-primary"
                              initial={{ width: 0 }}
                              animate={{ width: `${photo.uploadProgress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        )}
                        {/* Erreur */}
                        {photo.error && (
                          <div className="absolute inset-0 bg-destructive/90 flex items-center justify-center p-2">
                            <div className="text-center text-white text-xs">
                              <AlertCircle className="h-4 w-4 mx-auto mb-1" />
                              {photo.error}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Message d'aide */}
        {photos.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="rounded-lg border bg-muted/50 p-4 flex items-start gap-3"
          >
            <ImageIcon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Conseil</p>
              <p>
                Ajoutez au moins une photo de qualité pour attirer l'attention des locataires.
                La première photo sera utilisée comme photo de couverture.
              </p>
            </div>
          </motion.div>
        )}
      </div>

      <WizardFooter
        primary="Continuer"
        onPrimary={next}
        onBack={prev}
        disabled={!canContinue}
        hint={photos.length === 0 ? "Au moins une photo est requise" : "Vous pourrez ajouter plus de photos plus tard."}
      />
    </StepFrame>
  );
}
