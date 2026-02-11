"use client";

/**
 * PropertyPhotosGallery - Galerie photos avec lightbox
 * Architecture SOTA 2025 - Composant de présentation pur
 */

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ImageIcon,
  Maximize2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PropertyPhoto, PropertyType } from "./types";

const PHOTO_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f1f5f9' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%2394a3b8' font-size='14' dy='.3em'%3EImage non disponible%3C/text%3E%3C/svg%3E";

interface PropertyPhotosGalleryProps {
  photos: PropertyPhoto[];
  propertyType?: PropertyType;
  address?: string;
  location?: string;
  className?: string;
  /** Hauteur de la galerie principale */
  height?: string;
  /** Afficher overlay avec adresse sur photo principale */
  showAddressOverlay?: boolean;
}

export function PropertyPhotosGallery({
  photos,
  propertyType,
  address,
  location,
  className,
  height = "450px",
  showAddressOverlay = true,
}: PropertyPhotosGalleryProps) {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const mainPhoto = photos[0];
  const thumbnails = photos.slice(1, 3);
  const remainingCount = photos.length - 3;

  // Navigation galerie
  const navigateGallery = useCallback((direction: "prev" | "next") => {
    if (direction === "prev") {
      setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    } else {
      setSelectedPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    }
  }, [photos.length]);

  // Gestion clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isGalleryOpen) return;
      if (e.key === "ArrowLeft") navigateGallery("prev");
      if (e.key === "ArrowRight") navigateGallery("next");
      if (e.key === "Escape") setIsGalleryOpen(false);
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGalleryOpen, navigateGallery]);

  const openGallery = (index: number) => {
    setSelectedPhotoIndex(index);
    setIsGalleryOpen(true);
  };

  // Pas de photos
  if (!photos || photos.length === 0) {
    return (
      <div 
        className={cn(
          "rounded-2xl overflow-hidden bg-muted/50 border-2 border-dashed border-muted-foreground/20",
          "flex flex-col items-center justify-center text-muted-foreground gap-4",
          className
        )}
        style={{ height }}
      >
        <div className="p-4 bg-background rounded-full shadow-sm">
          <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Aucune photo</h3>
          <p className="text-sm text-muted-foreground">
            Ce bien n'a pas encore de photos
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Galerie principale */}
      <div 
        className={cn("grid grid-cols-1 md:grid-cols-4 gap-4", className)}
        style={{ height }}
      >
        {/* Photo principale */}
        <motion.div 
          className="col-span-1 md:col-span-3 relative rounded-2xl overflow-hidden bg-muted group cursor-pointer"
          onClick={() => openGallery(0)}
          whileHover={{ scale: 1.005 }}
          transition={{ duration: 0.2 }}
        >
          <Image
            src={mainPhoto.url}
            alt={address ? `Photo principale - ${address}` : "Photo principale du bien"}
            fill
            sizes="(max-width: 768px) 100vw, 75vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority
            onError={(e) => { (e.target as HTMLImageElement).src = PHOTO_FALLBACK; }}
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Overlay avec adresse */}
          {showAddressOverlay && (address || propertyType) && (
            <div className="absolute bottom-0 left-0 p-6 text-white">
              {propertyType && (
                <Badge className="mb-2 bg-white/20 backdrop-blur-sm border-0 text-white">
                  {propertyType}
                </Badge>
              )}
              {address && (
                <h2 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                  {address}
                </h2>
              )}
              {location && (
                <p className="text-white/80 mt-1">{location}</p>
              )}
            </div>
          )}
          
          {/* Bouton agrandir */}
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              className="bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white border-0"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Compteur photos mobile */}
          {photos.length > 1 && (
            <div className="absolute bottom-4 right-4 md:hidden">
              <Button
                size="sm"
                variant="secondary"
                className="bg-black/60 backdrop-blur-sm text-white border-none hover:bg-black/80 gap-2"
                onClick={(e) => { e.stopPropagation(); openGallery(0); }}
              >
                <ImageIcon className="w-4 h-4" />
                {photos.length} photos
              </Button>
            </div>
          )}
        </motion.div>

        {/* Colonne droite - Thumbnails */}
        <div className="hidden md:flex flex-col gap-4">
          {thumbnails.map((photo, idx) => (
            <motion.div 
              key={photo.id} 
              className="flex-1 relative rounded-xl overflow-hidden group cursor-pointer"
              onClick={() => openGallery(idx + 1)}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Image
                src={photo.url}
                alt={address ? `Photo ${idx + 2} - ${address}` : `Photo ${idx + 2}`}
                fill
                sizes="25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).src = PHOTO_FALLBACK; }}
              />
              
              {/* Overlay +N sur dernière thumbnail */}
              {idx === 1 && remainingCount > 0 && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center hover:bg-black/70 transition-colors">
                  <span className="text-white font-bold text-2xl">+{remainingCount}</span>
                  <span className="text-white/80 text-sm mt-1">Voir toutes</span>
                </div>
              )}
            </motion.div>
          ))}
          
          {/* Placeholder si moins de 3 photos */}
          {thumbnails.length < 2 && (
            <div className="flex-1 bg-muted rounded-xl flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent 
          className="max-w-7xl w-[95vw] h-[90vh] p-0 bg-black/95 border-none overflow-hidden flex flex-col"
          aria-describedby={undefined}
        >
          {/* DialogTitle requis pour l'accessibilité (screen readers) */}
          <DialogTitle className="sr-only">
            Galerie photos - {address || "Bien immobilier"}
          </DialogTitle>
          
          {/* Header */}
          <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between">
            <span className="text-white/80 text-sm bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
              {selectedPhotoIndex + 1} / {photos.length}
            </span>
            <DialogClose asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/20 rounded-full"
              >
                <X className="h-6 w-6" />
              </Button>
            </DialogClose>
          </div>

          {/* Zone principale */}
          <div className="flex-1 relative flex items-center justify-center">
            {/* Navigation précédent */}
            {photos.length > 1 && (
              <button
                onClick={() => navigateGallery("prev")}
                className="absolute left-4 z-40 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all hover:scale-110"
                aria-label="Photo précédente"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}

            {/* Photo actuelle */}
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedPhotoIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full h-full max-h-[75vh]"
              >
                <Image
                  src={photos[selectedPhotoIndex]?.url || ""}
                  alt={address ? `Photo ${selectedPhotoIndex + 1} - ${address}` : `Photo ${selectedPhotoIndex + 1}`}
                  fill
                  sizes="95vw"
                  className="object-contain"
                  priority
                  onError={(e) => { (e.target as HTMLImageElement).src = PHOTO_FALLBACK; }}
                />
              </motion.div>
            </AnimatePresence>

            {/* Navigation suivant */}
            {photos.length > 1 && (
              <button
                onClick={() => navigateGallery("next")}
                className="absolute right-4 z-40 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all hover:scale-110"
                aria-label="Photo suivante"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            )}
          </div>

          {/* Thumbnails en bas */}
          <div className="h-24 bg-black/80 backdrop-blur-sm p-4 flex gap-2 overflow-x-auto items-center justify-center">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => setSelectedPhotoIndex(idx)}
                className={cn(
                  "relative w-16 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                  idx === selectedPhotoIndex 
                    ? "border-white ring-2 ring-white/50 scale-110" 
                    : "border-transparent opacity-60 hover:opacity-100 hover:border-white/50"
                )}
              >
                <Image
                  src={photo.url}
                  alt={`Miniature ${idx + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = PHOTO_FALLBACK; }}
                />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

