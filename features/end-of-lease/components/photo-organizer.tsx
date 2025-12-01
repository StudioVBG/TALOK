"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { 
  GripVertical, 
  Trash2, 
  Plus, 
  Image as ImageIcon, 
  Camera,
  Check,
  X,
  ZoomIn,
  Star,
  StarOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import Image from "next/image";

export interface PhotoItem {
  id: string;
  url: string;
  roomId: string;
  isMain?: boolean;
  uploadedAt?: string;
}

export interface RoomForOrganizer {
  id: string;
  name: string;
  type: string;
  requiredPhotos: number;
}

interface PhotoOrganizerProps {
  rooms: RoomForOrganizer[];
  photos: PhotoItem[];
  onPhotoMove: (photoId: string, newRoomId: string) => void;
  onPhotoDelete: (photoId: string) => void;
  onPhotoReorder: (roomId: string, newOrder: string[]) => void;
  onSetMainPhoto?: (photoId: string, roomId: string) => void;
  onAddPhotos: (roomId: string) => void;
  className?: string;
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

interface DraggablePhotoProps {
  photo: PhotoItem;
  onDelete: () => void;
  onSetMain?: () => void;
  onZoom: () => void;
  isMain?: boolean;
}

function DraggablePhoto({ photo, onDelete, onSetMain, onZoom, isMain }: DraggablePhotoProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={cn(
        "relative group rounded-xl overflow-hidden aspect-square cursor-grab active:cursor-grabbing",
        "border-2 transition-all shadow-sm hover:shadow-md",
        isMain ? "border-amber-400 ring-2 ring-amber-200" : "border-transparent hover:border-blue-300"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Image 
        src={photo.url} 
        alt="" 
        fill 
        className="object-cover" 
        sizes="(max-width: 768px) 25vw, 150px"
      />
      
      {/* Indicateur photo principale */}
      {isMain && (
        <div className="absolute top-1 left-1 bg-amber-400 text-amber-900 p-1 rounded-md shadow">
          <Star className="h-3 w-3 fill-current" />
        </div>
      )}

      {/* Overlay actions */}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center gap-1"
          >
            {/* Zoom */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                onZoom();
              }}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            {/* Set as main */}
            {onSetMain && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 hover:bg-white/20",
                  isMain ? "text-amber-400" : "text-white"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetMain();
                }}
              >
                {isMain ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
              </Button>
            )}

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grip indicator */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 text-white drop-shadow-lg" />
      </div>
    </motion.div>
  );
}

interface DroppableRoomProps {
  room: RoomForOrganizer;
  photos: PhotoItem[];
  onPhotoDelete: (id: string) => void;
  onPhotoReorder: (newOrder: string[]) => void;
  onSetMainPhoto?: (photoId: string) => void;
  onAddPhotos: () => void;
  onZoomPhoto: (photo: PhotoItem) => void;
  allRooms: RoomForOrganizer[];
  onMoveToRoom: (photoId: string, roomId: string) => void;
}

function DroppableRoom({ 
  room, 
  photos, 
  onPhotoDelete, 
  onPhotoReorder,
  onSetMainPhoto,
  onAddPhotos,
  onZoomPhoto,
  allRooms,
  onMoveToRoom,
}: DroppableRoomProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [movingPhotoId, setMovingPhotoId] = useState<string | null>(null);

  const progress = Math.min(100, (photos.length / room.requiredPhotos) * 100);
  const isComplete = photos.length >= room.requiredPhotos;
  const icon = ROOM_ICONS[room.type] || ROOM_ICONS.autre;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const photoId = e.dataTransfer.getData("photoId");
    const sourceRoomId = e.dataTransfer.getData("roomId");
    if (photoId && sourceRoomId !== room.id) {
      onMoveToRoom(photoId, room.id);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        isDragOver && "ring-2 ring-blue-500 bg-blue-50/50 scale-[1.01]",
        isComplete && "bg-green-50/30"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            {room.name}
            {isComplete && (
              <Badge variant="default" className="bg-green-500 ml-2">
                <Check className="h-3 w-3 mr-1" />
                Complet
              </Badge>
            )}
          </CardTitle>
          <Badge 
            variant={isComplete ? "default" : photos.length > 0 ? "secondary" : "outline"}
            className={isComplete ? "bg-green-100 text-green-800" : ""}
          >
            {photos.length}/{room.requiredPhotos} photos
          </Badge>
        </div>
        
        {/* Barre de progression */}
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-3">
          <motion.div
            className={cn(
              "h-full",
              isComplete ? "bg-green-500" : photos.length > 0 ? "bg-blue-500" : "bg-slate-300"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {photos.length > 0 ? (
          <Reorder.Group
            axis="x"
            values={photos.map((p) => p.id)}
            onReorder={onPhotoReorder}
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2"
          >
            <AnimatePresence>
              {photos.map((photo) => (
                <Reorder.Item 
                  key={photo.id} 
                  value={photo.id}
                  draggable
                  onDragStart={(e: any) => {
                    if (e.dataTransfer) {
                      e.dataTransfer.setData("photoId", photo.id);
                      e.dataTransfer.setData("roomId", room.id);
                    }
                  }}
                >
                  <DraggablePhoto
                    photo={photo}
                    isMain={photo.isMain}
                    onDelete={() => onPhotoDelete(photo.id)}
                    onSetMain={onSetMainPhoto ? () => onSetMainPhoto(photo.id) : undefined}
                    onZoom={() => onZoomPhoto(photo)}
                  />
                  
                  {/* Sélecteur de déplacement */}
                  {movingPhotoId === photo.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border p-2 z-50"
                    >
                      <p className="text-xs text-muted-foreground mb-2 px-2">
                        Déplacer vers :
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {allRooms
                          .filter((r) => r.id !== room.id)
                          .map((r) => (
                            <button
                              key={r.id}
                              onClick={() => {
                                onMoveToRoom(photo.id, r.id);
                                setMovingPhotoId(null);
                              }}
                              className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                            >
                              {ROOM_ICONS[r.type] || "📍"} {r.name}
                            </button>
                          ))}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full mt-2 text-xs"
                        onClick={() => setMovingPhotoId(null)}
                      >
                        Annuler
                      </Button>
                    </motion.div>
                  )}
                </Reorder.Item>
              ))}
            </AnimatePresence>

            {/* Bouton ajouter */}
            <motion.button
              onClick={onAddPhotos}
              className={cn(
                "aspect-square rounded-xl border-2 border-dashed transition-all",
                "flex flex-col items-center justify-center gap-1",
                "text-slate-400 hover:text-blue-500",
                "border-slate-300 hover:border-blue-400 hover:bg-blue-50"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="h-6 w-6" />
              <span className="text-[10px] font-medium">Ajouter</span>
            </motion.button>
          </Reorder.Group>
        ) : (
          // État vide
          <motion.div 
            className={cn(
              "py-8 rounded-xl border-2 border-dashed transition-all text-center",
              isDragOver 
                ? "border-blue-400 bg-blue-50" 
                : "border-slate-200 bg-slate-50/50"
            )}
            animate={isDragOver ? { scale: 1.02 } : { scale: 1 }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                isDragOver ? "bg-blue-100" : "bg-slate-100"
              )}>
                <ImageIcon className={cn(
                  "h-6 w-6",
                  isDragOver ? "text-blue-500" : "text-slate-400"
                )} />
              </div>
              <div>
                <p className={cn(
                  "font-medium text-sm",
                  isDragOver ? "text-blue-600" : "text-slate-600"
                )}>
                  {isDragOver ? "Déposez ici" : "Aucune photo"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Glissez-déposez ou cliquez pour ajouter
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onAddPhotos}
                className="mt-2"
              >
                <Camera className="h-4 w-4 mr-2" />
                Ajouter des photos
              </Button>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

export function PhotoOrganizer({
  rooms,
  photos,
  onPhotoMove,
  onPhotoDelete,
  onPhotoReorder,
  onSetMainPhoto,
  onAddPhotos,
  className,
}: PhotoOrganizerProps) {
  const [zoomedPhoto, setZoomedPhoto] = useState<PhotoItem | null>(null);

  const totalPhotos = photos.length;
  const totalRequired = rooms.reduce((sum, r) => sum + r.requiredPhotos, 0);
  const completedRooms = rooms.filter((r) => {
    const roomPhotos = photos.filter((p) => p.roomId === r.id);
    return roomPhotos.length >= r.requiredPhotos;
  }).length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Stats header */}
      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-1">
            <Camera className="h-3 w-3" />
            {totalPhotos} photos
          </Badge>
          <Badge 
            variant={completedRooms === rooms.length ? "default" : "secondary"}
            className={completedRooms === rooms.length ? "bg-green-500" : ""}
          >
            {completedRooms}/{rooms.length} pièces
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Glissez-déposez pour réorganiser
        </p>
      </div>

      {/* Rooms grid */}
      <div className="space-y-4">
        {rooms.map((room) => (
          <DroppableRoom
            key={room.id}
            room={room}
            photos={photos.filter((p) => p.roomId === room.id)}
            onPhotoDelete={onPhotoDelete}
            onPhotoReorder={(newOrder) => onPhotoReorder(room.id, newOrder)}
            onSetMainPhoto={onSetMainPhoto ? (photoId) => onSetMainPhoto(photoId, room.id) : undefined}
            onAddPhotos={() => onAddPhotos(room.id)}
            onZoomPhoto={setZoomedPhoto}
            allRooms={rooms}
            onMoveToRoom={onPhotoMove}
          />
        ))}
      </div>

      {/* Modal zoom */}
      <Dialog open={!!zoomedPhoto} onOpenChange={() => setZoomedPhoto(null)}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 bg-black border-none">
          <DialogClose className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 rounded-full p-2">
            <X className="h-5 w-5" />
          </DialogClose>
          {zoomedPhoto && (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={zoomedPhoto.url}
                alt=""
                fill
                className="object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

