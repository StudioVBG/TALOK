"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader2, Trash2, Star, Download, CheckCircle2, AlertCircle, ImagePlus } from "lucide-react";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { propertiesService } from "@/features/properties/services/properties.service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from "next/image";
import { useToast } from "@/components/ui/use-toast";
import { cn, validateImageFiles, ACCEPTED_IMAGE_TYPES } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

// SOTA 2026: Taille max fichier (10MB)
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// SOTA 2026: Type pour les photos temporaires avec tracking ObjectURL
interface TempPhoto {
  id: string;
  url: string;
  file: File;
  objectUrl: string; // Pour cleanup
  is_main: boolean;
  property_id: string;
  room_id: null;
  tag: "vue_generale";
  ordre: number;
  created_at: string;
  updated_at: string;
  uploadStatus: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export function PhotosStep() {
  const {
    propertyId,
    photos,
    rooms,
    setPhotos,
    photoImportStatus,
    photoImportProgress,
    pendingPhotoUrls,
  } = usePropertyWizardStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  // SOTA 2026: Tracking des photos en cours d'upload pour cleanup ObjectURL
  const [tempPhotosMap, setTempPhotosMap] = useState<Map<string, TempPhoto>>(new Map());
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // SOTA 2026: Cleanup ObjectURLs au démontage
  useEffect(() => {
    return () => {
      tempPhotosMap.forEach((tempPhoto) => {
        URL.revokeObjectURL(tempPhoto.objectUrl);
      });
    };
  }, [tempPhotosMap]);

  // SOTA 2026: Cleanup ObjectURL après upload réussi
  const cleanupTempPhoto = useCallback((tempId: string) => {
    setTempPhotosMap((prev) => {
      const temp = prev.get(tempId);
      if (temp) {
        URL.revokeObjectURL(temp.objectUrl);
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      }
      return prev;
    });
  }, []);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !propertyId) return;

    // Validation des formats acceptés
    const { valid, invalid, invalidTypes } = validateImageFiles(files);

    // SOTA 2026: Validation taille fichier
    const oversizedFiles = valid.filter(f => f.size > MAX_FILE_SIZE_BYTES);
    const validSizedFiles = valid.filter(f => f.size <= MAX_FILE_SIZE_BYTES);

    if (oversizedFiles.length > 0) {
      toast({
        title: "Fichiers trop volumineux",
        description: `${oversizedFiles.length} fichier(s) dépassent ${MAX_FILE_SIZE_MB}MB et ont été ignorés.`,
        variant: "destructive"
      });
    }

    if (invalid.length > 0) {
      toast({
        title: "Format non supporté",
        description: `Les formats acceptés sont : JPEG, PNG et WebP. Format(s) rejeté(s) : ${invalidTypes.join(', ')}. Pour les fichiers HEIC, veuillez les convertir en JPEG.`,
        variant: "destructive"
      });
    }

    if (validSizedFiles.length === 0) {
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: validSizedFiles.length });

    // SOTA 2026: Créer photos temporaires avec tracking ObjectURL
    const newTempPhotos: TempPhoto[] = validSizedFiles.map((file, idx) => {
      const objectUrl = URL.createObjectURL(file);
      return {
        id: `temp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        url: objectUrl,
        objectUrl,
        file,
        is_main: false,
        property_id: propertyId,
        room_id: null,
        tag: "vue_generale" as const,
        ordre: photos.length + idx,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        uploadStatus: 'pending' as const,
      };
    });

    // Ajouter au tracking
    setTempPhotosMap((prev) => {
      const newMap = new Map(prev);
      newTempPhotos.forEach(tp => newMap.set(tp.id, tp));
      return newMap;
    });

    // Afficher immédiatement (optimistic UI)
    setPhotos([...photos, ...newTempPhotos] as any);

    // SOTA 2026: Upload séquentiel avec gestion d'erreur atomique
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < newTempPhotos.length; i++) {
      const tempPhoto = newTempPhotos[i];
      setUploadProgress({ current: i + 1, total: validSizedFiles.length });

      // Marquer comme "uploading"
      setTempPhotosMap((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(tempPhoto.id);
        if (existing) newMap.set(tempPhoto.id, { ...existing, uploadStatus: 'uploading' });
        return newMap;
      });

      try {
        // SOTA 2026: Demander URL signée
        const { upload_url, photo: serverPhoto } = await propertiesService.requestPhotoUploadUrl(propertyId, {
          file_name: tempPhoto.file.name,
          mime_type: tempPhoto.file.type,
          tag: "vue_generale"
        });

        // SOTA 2026: Upload vers Supabase Storage
        const uploadResponse = await fetch(upload_url, {
          method: "PUT",
          headers: { "Content-Type": tempPhoto.file.type },
          body: tempPhoto.file
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        // SOTA 2026: Upload réussi - cleanup ObjectURL et marquer succès
        cleanupTempPhoto(tempPhoto.id);
        successCount++;

      } catch (error: any) {
        console.error(`[PhotosStep] Erreur upload ${tempPhoto.file.name}:`, error);
        errors.push(tempPhoto.file.name);

        // Marquer comme erreur
        setTempPhotosMap((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(tempPhoto.id);
          if (existing) {
            newMap.set(tempPhoto.id, {
              ...existing,
              uploadStatus: 'error',
              errorMessage: error?.message || 'Erreur upload'
            });
          }
          return newMap;
        });
      }
    }

    // SOTA 2026: Recharger liste photos depuis serveur (source de vérité)
    try {
      const serverPhotos = await propertiesService.listPhotos(propertyId);
      setPhotos(serverPhotos);
    } catch {
      // Fallback: garder l'état actuel
    }

    // Feedback utilisateur
    if (successCount === validSizedFiles.length) {
      toast({ title: `${successCount} photo(s) ajoutée(s)`, variant: "default" });
    } else if (successCount > 0) {
      toast({
        title: "Upload partiel",
        description: `${successCount}/${validSizedFiles.length} photos uploadées. Erreurs: ${errors.join(', ')}`,
        variant: "default"
      });
    } else {
      toast({
        title: "Erreur upload",
        description: "Aucune photo n'a pu être uploadée. Vérifiez votre connexion.",
        variant: "destructive"
      });
    }

    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
  };

  // SOTA 2026: Suppression avec confirmation et gestion d'erreur améliorée
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (photoId: string) => {
    if (!propertyId || deletingId) return;

    // SOTA 2026: Cleanup si c'est une photo temporaire
    const tempPhoto = tempPhotosMap.get(photoId);
    if (tempPhoto) {
      cleanupTempPhoto(photoId);
      setPhotos(photos.filter(p => p.id !== photoId));
      return;
    }

    setDeletingId(photoId);
    const previousPhotos = [...photos];
    setPhotos(photos.filter(p => p.id !== photoId));

    try {
      await propertiesService.deletePhoto(photoId);
      toast({ title: "Photo supprimée" });
    } catch (error: any) {
      console.error('[PhotosStep] Erreur suppression:', error);
      // Rollback
      setPhotos(previousPhotos);
      toast({
        title: "Erreur suppression",
        description: "La photo n'a pas pu être supprimée. Réessayez.",
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetMain = async (photoId: string) => {
    if (!propertyId || photos.find(p => p.id === photoId)?.is_main) return;

    const previousPhotos = [...photos];
    setPhotos(photos.map(p => ({ ...p, is_main: p.id === photoId })));

    try {
      await propertiesService.updatePhoto(photoId, { is_main: true });
    } catch {
      setPhotos(previousPhotos);
      toast({ title: "Erreur", description: "Impossible de définir la photo principale.", variant: "destructive" });
    }
  };

  const handleAssignRoom = async (photoId: string, roomId: string) => {
    if (!propertyId) return;
    const effectiveRoomId = roomId === "none" ? null : roomId;

    const previousPhotos = [...photos];
    setPhotos(photos.map(p => p.id === photoId ? { ...p, room_id: effectiveRoomId } : p));

    try {
      await propertiesService.updatePhoto(photoId, { room_id: effectiveRoomId });
    } catch {
      setPhotos(previousPhotos);
    }
  };

  // SOTA 2026: Calcul progression upload pour affichage
  const isUploadingMultiple = uploadProgress.total > 1;
  const uploadPercentage = uploadProgress.total > 0 ? Math.round((uploadProgress.current / uploadProgress.total) * 100) : 0;

  return (
    <div className="h-full flex flex-col" role="region" aria-label="Gestion des photos du bien">
      {/* SOTA 2026: Indicateur d'import automatique avec aria-live */}
      {(photoImportStatus === 'importing' || (pendingPhotoUrls.length > 0 && photoImportStatus === 'idle')) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          aria-live="polite"
          className="flex-shrink-0 mb-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Download className="h-5 w-5 text-blue-600 animate-bounce" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Import des photos en cours...
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {photoImportStatus === 'importing'
                  ? `Téléchargement de ${pendingPhotoUrls.length} photo(s) depuis l'annonce`
                  : `${pendingPhotoUrls.length} photo(s) en attente d'import`
                }
              </p>
            </div>
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" aria-hidden="true" />
          </div>
          {photoImportStatus === 'importing' && (
            <Progress className="mt-3 h-1.5" value={50} aria-label="Progression import" />
          )}
        </motion.div>
      )}

      {/* SOTA 2026: Notification succès import avec aria-live */}
      {photoImportStatus === 'done' && photoImportProgress.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-live="polite"
          className="flex-shrink-0 mb-4 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 flex items-center gap-3"
        >
          <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
          <p className="text-sm text-green-700 dark:text-green-300">
            <strong>{photoImportProgress.imported}</strong> photo(s) importée(s) depuis l'annonce !
          </p>
        </motion.div>
      )}

      {/* SOTA 2026: Notification erreur import */}
      {photoImportStatus === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          aria-live="assertive"
          className="flex-shrink-0 mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-3"
        >
          <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Certaines photos n'ont pas pu être importées. Ajoutez-les manuellement.
          </p>
        </motion.div>
      )}

      {/* SOTA 2026: Barre de progression upload multiple */}
      {uploading && isUploadingMultiple && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          role="status"
          aria-live="polite"
          className="flex-shrink-0 mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20"
        >
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">Upload en cours...</span>
            <span className="text-muted-foreground">{uploadProgress.current}/{uploadProgress.total}</span>
          </div>
          <Progress value={uploadPercentage} className="h-2" aria-label={`${uploadPercentage}% uploadé`} />
        </motion.div>
      )}

      {/* SOTA 2026: Zone Drop améliorée avec accessibilité */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Zone de dépôt de photos. ${photos.length} photo(s) actuellement. Cliquez ou glissez des fichiers pour ajouter.`}
        className={cn(
          "flex-shrink-0 border-2 border-dashed rounded-xl p-4 mb-4 transition-all flex items-center gap-4 cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/20 hover:border-primary/50",
          uploading && "pointer-events-none opacity-60"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
          aria-label="Sélectionner des photos"
        />
        <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium">{uploading ? 'Upload en cours...' : 'Glissez vos photos ou cliquez'}</p>
          <p className="text-sm text-muted-foreground">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} • Max {MAX_FILE_SIZE_MB}MB par fichier
          </p>
        </div>
      </div>

      {/* SOTA 2026: Grille Photos avec accessibilité améliorée */}
      <div className="flex-1 min-h-0 overflow-y-auto" role="list" aria-label="Liste des photos">
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
            <AnimatePresence>
              {photos.map((photo, index) => {
                const isTemp = photo.id.startsWith('temp-');
                const tempData = isTemp ? tempPhotosMap.get(photo.id) : null;
                const isDeleting = deletingId === photo.id;
                const photoTag = (photo as any).tag || 'vue_generale';

                return (
                  <motion.div
                    key={photo.id}
                    layout
                    role="listitem"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: isDeleting ? 0.5 : 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={cn(
                      "relative rounded-xl overflow-hidden border bg-card group aspect-square",
                      "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
                      isTemp && tempData?.uploadStatus === 'uploading' && "animate-pulse"
                    )}
                  >
                    <Image
                      src={photo.url || ""}
                      alt={`Photo ${index + 1}${photo.is_main ? ' - Photo principale' : ''}: ${photoTag.replace(/_/g, ' ')}`}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 150px"
                      className={cn(
                        "object-cover transition-all",
                        photo.is_main && "ring-2 ring-primary ring-inset"
                      )}
                    />

                    {/* Badge photo principale */}
                    {photo.is_main && (
                      <span className="absolute top-1.5 left-1.5 bg-primary text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 shadow-sm">
                        <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                        <span className="sr-only">Photo principale</span>
                      </span>
                    )}

                    {/* SOTA 2026: Indicateur upload en cours */}
                    {isTemp && tempData?.uploadStatus === 'uploading' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-white animate-spin" aria-label="Upload en cours" />
                      </div>
                    )}

                    {/* SOTA 2026: Indicateur erreur upload */}
                    {isTemp && tempData?.uploadStatus === 'error' && (
                      <div className="absolute inset-0 bg-red-500/40 flex flex-col items-center justify-center p-2">
                        <AlertCircle className="h-5 w-5 text-white mb-1" aria-hidden="true" />
                        <span className="text-white text-[9px] text-center">Erreur</span>
                      </div>
                    )}

                    {/* SOTA 2026: Overlay actions avec accessibilité */}
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent",
                        "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity",
                        "flex flex-col items-center justify-end gap-1.5 p-2"
                      )}
                    >
                      {!photo.is_main && !isTemp && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSetMain(photo.id); }}
                          aria-label={`Définir la photo ${index + 1} comme principale`}
                          className="bg-white/95 text-foreground text-[10px] px-2.5 py-1.5 rounded-full font-medium hover:bg-white flex items-center gap-1 shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <Star className="h-3 w-3" aria-hidden="true" /> Principale
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                        disabled={isDeleting}
                        aria-label={`Supprimer la photo ${index + 1}`}
                        className="bg-destructive/90 text-white text-[10px] px-2.5 py-1.5 rounded-full font-medium hover:bg-destructive flex items-center gap-1 shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        )}
                        Supprimer
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* SOTA 2026: État vide amélioré */
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ImagePlus className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-muted-foreground">Aucune photo ajoutée</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Ajoutez des photos pour mettre en valeur votre bien
            </p>
          </div>
        )}
      </div>

      {/* SOTA 2026: Liaison pièces améliorée */}
      {photos.length > 0 && rooms.length > 0 && (
        <div className="flex-shrink-0 border-t pt-3 mt-3" role="region" aria-label="Association des photos aux pièces">
          <p className="text-xs font-medium text-muted-foreground mb-2">Associer aux pièces (optionnel)</p>
          <div className="flex flex-wrap gap-2">
            {photos.filter(p => !p.id.startsWith('temp-')).slice(0, 5).map((photo, idx) => (
              <div key={photo.id} className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1.5">
                <div className="h-8 w-8 rounded-md overflow-hidden relative flex-shrink-0">
                  <Image
                    src={photo.url || ""}
                    alt={`Photo ${idx + 1}`}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
                <Select value={photo.room_id || "none"} onValueChange={(val) => handleAssignRoom(photo.id, val)}>
                  <SelectTrigger
                    className="h-7 text-[10px] w-24 border-0 bg-transparent hover:bg-muted/50"
                    aria-label={`Associer photo ${idx + 1} à une pièce`}
                  >
                    <SelectValue placeholder="Pièce..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Vue générale</SelectItem>
                    {rooms.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.label_affiche}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {photos.filter(p => !p.id.startsWith('temp-')).length > 5 && (
              <span className="text-xs text-muted-foreground self-center px-2">
                +{photos.filter(p => !p.id.startsWith('temp-')).length - 5} autres
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
