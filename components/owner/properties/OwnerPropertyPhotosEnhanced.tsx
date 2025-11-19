"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Upload, ZoomIn, ZoomOut } from "lucide-react";
import type { OwnerPropertyPhoto } from "@/lib/owner/types";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";

interface OwnerPropertyPhotosEnhancedProps {
  photos: OwnerPropertyPhoto[];
  propertyId: string;
  onUploadClick?: () => void;
}

const PHOTO_TAG_LABELS: Record<string, string> = {
  vue_generale: "Vue générale",
  plan: "Plan",
  detail: "Détail",
  exterieur: "Extérieur",
  emplacement: "Emplacement",
  acces: "Accès",
  facade: "Façade",
  interieur: "Intérieur",
  vitrine: "Vitrine",
  autre: "Autre",
};

export function OwnerPropertyPhotosEnhanced({
  photos,
  propertyId,
  onUploadClick,
}: OwnerPropertyPhotosEnhancedProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Navigation clavier
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1));
      } else if (e.key === "ArrowRight") {
        setSelectedIndex((prev) => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0));
      } else if (e.key === "Escape") {
        closeLightbox();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, photos.length]);

  // Swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => selectedIndex !== null && navigateLightbox("next"),
    onSwipedRight: () => selectedIndex !== null && navigateLightbox("prev"),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    if (selectedIndex === null) return;

    if (direction === "prev") {
      setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : photos.length - 1);
    } else {
      setSelectedIndex(selectedIndex < photos.length - 1 ? selectedIndex + 1 : 0);
    }
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      if (info.offset.x > 0) {
        navigateLightbox("prev");
      } else {
        navigateLightbox("next");
      }
    }
  };

  if (!photos || photos.length === 0) {
    return (
      <Card className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-700/50 shadow-xl">
        <CardContent className="py-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 rounded-full blur-xl opacity-50" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 flex items-center justify-center">
                <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Aucune photo</p>
              <p className="text-sm text-muted-foreground mb-4">
                Ajoutez des photos pour mieux présenter votre bien
              </p>
              {onUploadClick && (
                <Button onClick={onUploadClick} variant="outline" className="shadow-md hover:shadow-lg transition-shadow">
                  <Upload className="mr-2 h-4 w-4" />
                  Ajouter des photos
                </Button>
              )}
            </div>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  const mainPhoto = photos.find((p) => p.is_main) || photos[0];
  const otherPhotos = photos.filter((p) => p.id !== mainPhoto.id);

  return (
    <>
      <Card className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-700/50 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {/* Photo principale avec animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative aspect-video w-full overflow-hidden bg-muted group"
          >
            {mainPhoto.url ? (
              <motion.img
                src={mainPhoto.url}
                alt={mainPhoto.tag ? PHOTO_TAG_LABELS[mainPhoto.tag] || "Photo principale" : "Photo principale"}
                className="w-full h-full object-cover cursor-pointer"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
                onClick={() => openLightbox(0)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Upload className="h-12 w-12" />
              </div>
            )}
            {mainPhoto.tag && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Badge className="absolute top-4 left-4 shadow-md" variant="secondary">
                  {PHOTO_TAG_LABELS[mainPhoto.tag] || mainPhoto.tag}
                </Badge>
              </motion.div>
            )}
            {mainPhoto.is_main && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
              >
                <Badge className="absolute top-4 right-4 shadow-md" variant="default">
                  Principale
                </Badge>
              </motion.div>
            )}
            {/* Overlay au survol */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileHover={{ opacity: 1, scale: 1 }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  className="shadow-lg backdrop-blur-sm bg-white/90"
                  onClick={() => openLightbox(0)}
                >
                  <ZoomIn className="mr-2 h-4 w-4" />
                  Voir en grand
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Galerie des autres photos */}
          {otherPhotos.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-4 gap-2 p-4"
            >
              {otherPhotos.slice(0, 8).map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * index }}
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted cursor-pointer group"
                  onClick={() => openLightbox(index + 1)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.tag ? PHOTO_TAG_LABELS[photo.tag] || `Photo ${index + 2}` : `Photo ${index + 2}`}
                      className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <Upload className="h-6 w-6" />
                    </div>
                  )}
                  {photo.tag && (
                    <Badge className="absolute bottom-1 left-1 text-xs shadow-sm" variant="secondary">
                      {PHOTO_TAG_LABELS[photo.tag] || photo.tag}
                    </Badge>
                  )}
                  {/* Overlay au survol */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </motion.div>
              ))}
              {otherPhotos.length > 8 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 * 8 }}
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => openLightbox(9)}
                >
                  +{otherPhotos.length - 8}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Bouton ajouter des photos */}
          {onUploadClick && (
            <div className="px-4 pb-4">
              <Button
                onClick={onUploadClick}
                variant="outline"
                className="w-full shadow-md hover:shadow-lg transition-shadow"
              >
                <Upload className="mr-2 h-4 w-4" />
                Ajouter des photos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox amélioré avec animations */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeLightbox}
            {...swipeHandlers}
          >
            {/* Bouton fermer */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
              className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
            >
              <X className="h-6 w-6" />
            </motion.button>

            {/* Navigation précédent */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox("prev");
              }}
              className="absolute left-4 z-10 text-white hover:text-gray-300 transition-colors p-3 rounded-full hover:bg-white/10 backdrop-blur-sm"
            >
              <ChevronLeft className="h-8 w-8" />
            </motion.button>

            {/* Navigation suivant */}
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox("next");
              }}
              className="absolute right-4 z-10 text-white hover:text-gray-300 transition-colors p-3 rounded-full hover:bg-white/10 backdrop-blur-sm"
            >
              <ChevronRight className="h-8 w-8" />
            </motion.button>

            {/* Image avec drag et zoom */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: zoom }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={handleDragEnd}
              style={{ x: position.x, y: position.y }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={selectedIndex}
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3 }}
                  src={photos[selectedIndex]?.url}
                  alt={`Photo ${selectedIndex + 1}`}
                  className="max-w-full max-h-[90vh] object-contain select-none"
                  draggable={false}
                />
              </AnimatePresence>
            </motion.div>

            {/* Indicateur de position */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full"
            >
              {selectedIndex + 1} / {photos.length}
            </motion.div>

            {/* Thumbnails en bas */}
            {photos.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 max-w-4xl overflow-x-auto px-4 pb-2"
              >
                {photos.map((photo, index) => (
                  <motion.button
                    key={photo.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openLightbox(index);
                    }}
                    className={cn(
                      "relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                      index === selectedIndex
                        ? "border-white scale-110"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img
                      src={photo.url}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </motion.button>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

