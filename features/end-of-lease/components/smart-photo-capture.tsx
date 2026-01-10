"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Upload,
  Loader2,
  RotateCcw,
  Maximize2,
  Minimize2,
  Hand
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";

export interface RoomOption {
  id: string;
  name: string;
  type: string;
}

export interface CapturedPhoto {
  id: string;
  file: File;
  preview: string;
  roomId: string | null;
  timestamp: Date;
}

interface SmartPhotoCaptureProps {
  rooms: RoomOption[];
  onPhotosConfirm: (photos: Array<{ file: File; roomId: string }>) => Promise<void>;
  onClose: () => void;
  initialRoomId?: string | null;
}

const ROOM_ICONS: Record<string, string> = {
  sejour: "🛋️",
  salon: "🛋️",
  cuisine: "🍳",
  chambre: "🛏️",
  salle_de_bain: "🚿",
  wc: "🚽",
  toilettes: "🚽",
  entree: "🚪",
  couloir: "🚶",
  balcon: "🌿",
  terrasse: "☀️",
  cave: "📦",
  garage: "🚗",
  parking: "🅿️",
  bureau: "💼",
  buanderie: "🧺",
  cellier: "🗄️",
  dressing: "👔",
  autre: "📍",
};

export function SmartPhotoCapture({
  rooms,
  onPhotosConfirm,
  onClose,
  initialRoomId = null,
}: SmartPhotoCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [preSelectedRoom, setPreSelectedRoom] = useState<string | null>(initialRoomId);

  const currentPhoto = photos[currentIndex];
  const unassignedCount = photos.filter((p) => !p.roomId).length;
  const allAssigned = photos.length > 0 && unassignedCount === 0;

  // Détection mobile
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

  // Capture de photo
  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((file) => {
      if (!file.type.startsWith("image/")) {
        console.warn(`Fichier ignoré (pas une image): ${file.name}`);
        return false;
      }
      if (file.size > 15 * 1024 * 1024) {
        console.warn(`Fichier ignoré (trop volumineux): ${file.name}`);
        return false;
      }
      return true;
    });

    const newPhotos: CapturedPhoto[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      roomId: preSelectedRoom, // Pré-assigner si une pièce est sélectionnée
      timestamp: new Date(),
    }));

    setPhotos((prev) => [...prev, ...newPhotos]);
    
    // Reset inputs
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [preSelectedRoom]);

  // Assignation de pièce
  const assignRoom = useCallback((roomId: string) => {
    if (!currentPhoto) return;

    setPhotos((prev) =>
      prev.map((p) =>
        p.id === currentPhoto.id ? { ...p, roomId } : p
      )
    );

    // Passer à la photo suivante non assignée
    setTimeout(() => {
      const updatedPhotos = photos.map((p) =>
        p.id === currentPhoto.id ? { ...p, roomId } : p
      );
      const nextUnassigned = updatedPhotos.findIndex(
        (p, i) => i > currentIndex && !p.roomId
      );
      if (nextUnassigned !== -1) {
        setCurrentIndex(nextUnassigned);
      }
      setIsAssigning(false);
    }, 200);
  }, [currentPhoto, photos, currentIndex]);

  // Suppression photo
  const deletePhoto = useCallback(() => {
    if (!currentPhoto) return;
    URL.revokeObjectURL(currentPhoto.preview);
    
    setPhotos((prev) => {
      const newPhotos = prev.filter((p) => p.id !== currentPhoto.id);
      if (currentIndex >= newPhotos.length && newPhotos.length > 0) {
        setCurrentIndex(newPhotos.length - 1);
      }
      return newPhotos;
    });
  }, [currentPhoto, currentIndex]);

  // Navigation
  const goNext = () => setCurrentIndex((i) => Math.min(photos.length - 1, i + 1));
  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));

  // Confirmation finale
  const handleConfirm = async () => {
    const assignedPhotos = photos
      .filter((p) => p.roomId)
      .map((p) => ({ file: p.file, roomId: p.roomId! }));

    if (assignedPhotos.length === 0) return;

    setIsUploading(true);
    try {
      await onPhotosConfirm(assignedPhotos);
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      onClose();
    } catch (error) {
      console.error("Erreur upload:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // Geste swipe pour assigner
  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.y < -80 && currentPhoto && !currentPhoto.roomId) {
      setIsAssigning(true);
    }
    setDragY(0);
  };

  // Pré-sélection de pièce pour les prochaines captures
  const handlePreSelectRoom = (roomId: string) => {
    setPreSelectedRoom((prev) => (prev === roomId ? null : roomId));
  };

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-black flex flex-col",
      isFullscreen && "bg-black"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
          aria-label="Fermer le mode capture"
        >
          <X className="h-6 w-6" />
        </Button>
        
        <div className="text-white text-center">
          <p className="text-sm opacity-80">
            {photos.length === 0 ? "Mode capture" : `${photos.length} photo${photos.length > 1 ? "s" : ""}`}
          </p>
          {photos.length > 0 && (
            <p className="font-semibold text-xs flex items-center gap-1">
              {unassignedCount > 0
                ? `${unassignedCount} à assigner`
                : <><Check className="h-3 w-3" aria-hidden="true" /><span>Toutes assignées</span></>}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-white hover:bg-white/20"
            aria-label={isFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleConfirm}
            disabled={!allAssigned || isUploading}
            className={cn(
              "text-white",
              allAssigned && !isUploading && "bg-green-500 hover:bg-green-600"
            )}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : allAssigned ? (
              <>
                <Check className="mr-1 h-4 w-4" />
                Valider
              </>
            ) : (
              "Valider"
            )}
          </Button>
        </div>
      </div>

      {/* Zone photo principale */}
      <div className="flex-1 flex items-center justify-center relative pt-16 pb-32">
        {photos.length === 0 ? (
          // État vide - CTA capture
          <div className="text-center text-white space-y-6 p-8">
            <motion.div 
              className="w-28 h-28 mx-auto rounded-full bg-white/10 flex items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Camera className="w-14 h-14" />
            </motion.div>
            
            <div>
              <h2 className="text-xl font-bold mb-2">Capturez vos photos</h2>
              <p className="text-white/70 text-sm max-w-xs mx-auto">
                {isMobile 
                  ? "Prenez les photos avec votre appareil, vous les assignerez aux pièces ensuite"
                  : "Sélectionnez vos photos depuis votre ordinateur"}
              </p>
            </div>

            {/* Pré-sélection de pièce optionnelle */}
            {rooms.length > 0 && (
              <div className="space-y-2">
                <p className="text-white/60 text-xs">
                  Optionnel : pré-sélectionnez une pièce
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {rooms.slice(0, 6).map((room) => (
                    <button
                      key={room.id}
                      onClick={() => handlePreSelectRoom(room.id)}
                      aria-pressed={preSelectedRoom === room.id}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm transition-all",
                        preSelectedRoom === room.id
                          ? "bg-blue-500 text-white"
                          : "bg-white/10 text-white/80 hover:bg-white/20"
                      )}
                    >
                      <span aria-hidden="true">{ROOM_ICONS[room.type] || "📍"}</span> {room.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Inputs cachés */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleCapture}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleCapture}
              className="hidden"
            />

            {/* Boutons capture */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {isMobile && (
                <Button
                  size="lg"
                  onClick={() => cameraInputRef.current?.click()}
                  className="bg-white text-black hover:bg-white/90"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Prendre des photos
                </Button>
              )}
              <Button
                size="lg"
                variant={isMobile ? "outline" : "default"}
                onClick={() => fileInputRef.current?.click()}
                className={isMobile ? "border-white/30 text-white hover:bg-white/10" : "bg-white text-black hover:bg-white/90"}
              >
                <Upload className="mr-2 h-5 w-5" />
                {isMobile ? "Depuis la galerie" : "Sélectionner des fichiers"}
              </Button>
            </div>
          </div>
        ) : (
          // Carrousel de photos
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPhoto?.id}
              className="relative w-full h-full max-w-2xl mx-auto px-4"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.2 }}
              drag={currentPhoto && !currentPhoto.roomId ? "y" : false}
              dragConstraints={{ top: -100, bottom: 0 }}
              dragElastic={0.3}
              onDrag={(e, info) => setDragY(info.offset.y)}
              onDragEnd={handleDragEnd}
            >
              {currentPhoto && (
                <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
                  <Image
                    src={currentPhoto.preview}
                    alt={`Photo ${currentIndex + 1}`}
                    fill
                    className="object-contain bg-black/50"
                    priority
                  />

                  {/* Badge pièce assignée */}
                  {currentPhoto.roomId && (
                    <motion.div
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg"
                      role="status"
                      aria-label={`Photo assignée à ${rooms.find((r) => r.id === currentPhoto.roomId)?.name}`}
                    >
                      <span className="text-lg" aria-hidden="true">
                        {ROOM_ICONS[rooms.find((r) => r.id === currentPhoto.roomId)?.type || ""] || "📍"}
                      </span>
                      <span className="font-medium">
                        {rooms.find((r) => r.id === currentPhoto.roomId)?.name}
                      </span>
                      <Check className="w-4 h-4" aria-hidden="true" />
                    </motion.div>
                  )}

                  {/* Bouton réassigner */}
                  {currentPhoto.roomId && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-4 right-4"
                      onClick={() => setIsAssigning(true)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Changer
                    </Button>
                  )}

                  {/* Indicateur swipe up */}
                  {!currentPhoto.roomId && !isAssigning && (
                    <motion.div
                      className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-center"
                      animate={{ y: [0, -15, 0] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      role="status"
                      aria-label="Glissez vers le haut pour assigner cette photo à une pièce"
                    >
                      <Hand className="h-10 w-10 mx-auto mb-2 rotate-180" aria-hidden="true" />
                      <p className="text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                        Glissez pour assigner
                      </p>
                    </motion.div>
                  )}

                  {/* Indicateur de position */}
                  <div className="absolute bottom-4 right-4 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                    {currentIndex + 1} / {photos.length}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Navigation gauche/droite */}
        {photos.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-black/30 hover:bg-black/50 rounded-full h-12 w-12 disabled:opacity-30"
              aria-label="Photo précédente"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              disabled={currentIndex === photos.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-black/30 hover:bg-black/50 rounded-full h-12 w-12 disabled:opacity-30"
              aria-label="Photo suivante"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </>
        )}
      </div>

      {/* Sélecteur de pièces (slide up) */}
      <AnimatePresence>
        {isAssigning && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/98 to-transparent pt-20 pb-8 px-4 z-30"
          >
            <div className="text-center text-white mb-6">
              <p className="font-semibold text-lg">Assigner à quelle pièce ?</p>
              <p className="text-white/60 text-sm">Sélectionnez la pièce correspondante</p>
            </div>

            {/* Grille de pièces */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-w-lg mx-auto" role="listbox" aria-label="Sélectionnez une pièce">
              {rooms.map((room, idx) => (
                <motion.button
                  key={room.id}
                  onClick={() => assignRoom(room.id)}
                  role="option"
                  aria-label={`Assigner à ${room.name}`}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-4 rounded-xl transition-all",
                    "bg-white/10 hover:bg-white/20 active:bg-white/30",
                    "border-2 border-transparent hover:border-white/30"
                  )}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <span className="text-3xl" aria-hidden="true">{ROOM_ICONS[room.type] || "📍"}</span>
                  <span className="text-white text-xs font-medium truncate max-w-full text-center">
                    {room.name}
                  </span>
                </motion.button>
              ))}
            </div>

            <Button
              variant="ghost"
              className="mt-6 mx-auto block text-white/60 hover:text-white"
              onClick={() => setIsAssigning(false)}
            >
              <X className="mr-2 h-4 w-4" />
              Annuler
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer - Miniatures et actions */}
      {photos.length > 0 && !isAssigning && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent">
          <div className="flex items-center justify-between max-w-2xl mx-auto gap-4">
            {/* Supprimer */}
            <Button
              variant="ghost"
              size="icon"
              onClick={deletePhoto}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/20 flex-shrink-0"
              aria-label="Supprimer cette photo"
            >
              <Trash2 className="h-5 w-5" />
            </Button>

            {/* Miniatures scrollables */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-2 py-2 px-1">
                {photos.map((photo, idx) => (
                  <button
                    key={photo.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                      idx === currentIndex
                        ? "border-white scale-110 shadow-lg"
                        : photo.roomId
                        ? "border-green-500/70"
                        : "border-amber-500/70 animate-pulse"
                    )}
                  >
                    <Image 
                      src={photo.preview} 
                      alt="" 
                      fill 
                      className="object-cover" 
                    />
                    {photo.roomId && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      </div>
                    )}
                    {!photo.roomId && idx !== currentIndex && (
                      <div className="absolute inset-0 bg-amber-500/20" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Ajouter plus */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleCapture}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleCapture}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (isMobile ? cameraInputRef : fileInputRef).current?.click()}
              className="text-white bg-white/10 hover:bg-white/20 flex-shrink-0"
              aria-label="Ajouter des photos"
            >
              <Camera className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

