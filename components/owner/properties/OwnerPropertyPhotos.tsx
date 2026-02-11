"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Upload, ZoomIn, ZoomOut } from "lucide-react";
import type { OwnerPropertyPhoto } from "@/lib/owner/types";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";

const PHOTO_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f1f5f9' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%2394a3b8' font-size='14' dy='.3em'%3EImage non disponible%3C/text%3E%3C/svg%3E";

interface OwnerPropertyPhotosProps {
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

export function OwnerPropertyPhotos({ photos, propertyId, onUploadClick }: OwnerPropertyPhotosProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!photos || photos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">Aucune photo</p>
              <p className="text-sm text-muted-foreground mb-4">
                Ajoutez des photos pour mieux présenter votre bien
              </p>
              {onUploadClick && (
                <Button onClick={onUploadClick} variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Ajouter des photos
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const mainPhoto = photos.find(p => p.is_main) || photos[0];
  const otherPhotos = photos.filter(p => p.id !== mainPhoto.id);

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    if (selectedIndex === null) return;
    
    if (direction === "prev") {
      setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : photos.length - 1);
    } else {
      setSelectedIndex(selectedIndex < photos.length - 1 ? selectedIndex + 1 : 0);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Photo principale */}
          <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
            {mainPhoto.url ? (
              <img
                src={mainPhoto.url}
                alt={mainPhoto.tag ? PHOTO_TAG_LABELS[mainPhoto.tag] || "Photo principale" : "Photo principale"}
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => openLightbox(0)}
                onError={(e) => { (e.target as HTMLImageElement).src = PHOTO_FALLBACK; }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Upload className="h-12 w-12" />
              </div>
            )}
            {mainPhoto.tag && (
              <Badge className="absolute top-4 left-4" variant="secondary">
                {PHOTO_TAG_LABELS[mainPhoto.tag] || mainPhoto.tag}
              </Badge>
            )}
            {mainPhoto.is_main && (
              <Badge className="absolute top-4 right-4" variant="default">
                Principale
              </Badge>
            )}
          </div>

          {/* Galerie des autres photos */}
          {otherPhotos.length > 0 && (
            <div className="grid grid-cols-4 gap-2 p-4">
              {otherPhotos.slice(0, 8).map((photo, index) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => openLightbox(index + 1)}
                >
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.tag ? PHOTO_TAG_LABELS[photo.tag] || `Photo ${index + 2}` : `Photo ${index + 2}`}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = PHOTO_FALLBACK; }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <Upload className="h-6 w-6" />
                    </div>
                  )}
                  {photo.tag && (
                    <Badge className="absolute bottom-1 left-1 text-xs" variant="secondary">
                      {PHOTO_TAG_LABELS[photo.tag] || photo.tag}
                    </Badge>
                  )}
                </div>
              ))}
              {otherPhotos.length > 8 && (
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                  +{otherPhotos.length - 8}
                </div>
              )}
            </div>
          )}

          {/* Bouton ajouter des photos */}
          {onUploadClick && (
            <div className="px-4 pb-4">
              <Button onClick={onUploadClick} variant="outline" className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                Ajouter des photos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigateLightbox("prev");
            }}
            className="absolute left-4 text-white hover:text-gray-300 transition-colors"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigateLightbox("next");
            }}
            className="absolute right-4 text-white hover:text-gray-300 transition-colors"
          >
            <ChevronRight className="h-8 w-8" />
          </button>

          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {photos[selectedIndex]?.url && (
              <img
                src={photos[selectedIndex].url}
                alt={`Photo ${selectedIndex + 1}`}
                className="max-w-full max-h-[90vh] object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = PHOTO_FALLBACK; }}
              />
            )}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
            {selectedIndex + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  );
}

