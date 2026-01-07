"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Map, 
  Camera, 
  Grid3X3, 
  ArrowLeftRight, 
  Save, 
  Send,
  Loader2,
  ChevronLeft,
  Settings,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { RoomPlanSelector, type RoomForPlan } from "./room-plan-selector";
import { SmartPhotoCapture, type RoomOption, type CapturedPhoto } from "./smart-photo-capture";
import { PhotoOrganizer, type PhotoItem, type RoomForOrganizer } from "./photo-organizer";
import { EDLPhotoComparison, type ComparisonPhoto } from "./edl-photo-comparison";

// ==================== TYPES ====================

export interface EDLRoom {
  id: string;
  name: string;
  type: string;
  requiredPhotos: number;
}

export interface EDLPhoto {
  id: string;
  url: string;
  roomId: string;
  isMain?: boolean;
  uploadedAt: string;
  condition?: "neuf" | "bon" | "moyen" | "mauvais" | "tres_mauvais";
}

export interface EDLData {
  id: string;
  type: "entree" | "sortie";
  status: "draft" | "in_progress" | "completed" | "signed";
  propertyAddress: string;
  rooms: EDLRoom[];
  photos: EDLPhoto[];
  entryPhotos?: EDLPhoto[]; // Photos de l'EDL d'entrée pour comparaison
}

interface EDLConductorProps {
  edlData: EDLData;
  onPhotosUpload: (photos: Array<{ file: File; roomId: string }>) => Promise<EDLPhoto[]>;
  onPhotoDelete: (photoId: string) => Promise<void>;
  onPhotoMove: (photoId: string, newRoomId: string) => Promise<void>;
  onPhotoReorder: (roomId: string, newOrder: string[]) => Promise<void>;
  onSetMainPhoto?: (photoId: string, roomId: string) => Promise<void>;
  onSave: () => Promise<void>;
  onFinalize: () => Promise<void>;
  onBack: () => void;
  className?: string;
}

type ViewMode = "plan" | "capture" | "organize" | "compare";

// ==================== COMPOSANT PRINCIPAL ====================

export function EDLConductor({
  edlData,
  onPhotosUpload,
  onPhotoDelete,
  onPhotoMove,
  onPhotoReorder,
  onSetMainPhoto,
  onSave,
  onFinalize,
  onBack,
  className,
}: EDLConductorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("plan");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const { rooms, photos, entryPhotos = [], type: edlType } = edlData;
  const isExitEDL = edlType === "sortie";

  // ==================== CALCULS ====================

  const roomsWithProgress = useMemo((): RoomForPlan[] => {
    return rooms.map((room) => {
      const roomPhotos = photos.filter((p) => p.roomId === room.id);
      return {
        ...room,
        photoCount: roomPhotos.length,
        isComplete: roomPhotos.length >= room.requiredPhotos,
      };
    });
  }, [rooms, photos]);

  const totalPhotos = photos.length;
  const totalRequired = rooms.reduce((sum, r) => sum + r.requiredPhotos, 0);
  const globalProgress = totalRequired > 0 ? Math.min(100, (totalPhotos / totalRequired) * 100) : 0;
  const completedRooms = roomsWithProgress.filter((r) => r.isComplete).length;
  const allComplete = completedRooms === rooms.length;

  // ==================== HANDLERS ====================

  const handleRoomSelect = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    // Ouvrir directement la capture pour cette pièce
    setIsCaptureOpen(true);
  }, []);

  const handlePhotosConfirm = useCallback(async (
    capturedPhotos: Array<{ file: File; roomId: string }>
  ) => {
    setIsUploadingPhotos(true);
    try {
      await onPhotosUpload(capturedPhotos);
      setIsCaptureOpen(false);
      setSelectedRoomId(null);
    } finally {
      setIsUploadingPhotos(false);
    }
  }, [onPhotosUpload]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  const handleFinalize = useCallback(async () => {
    setIsSaving(true);
    try {
      await onFinalize();
    } finally {
      setIsSaving(false);
    }
  }, [onFinalize]);

  const handlePhotoDelete = useCallback(async (photoId: string) => {
    await onPhotoDelete(photoId);
  }, [onPhotoDelete]);

  const handlePhotoMove = useCallback(async (photoId: string, newRoomId: string) => {
    await onPhotoMove(photoId, newRoomId);
  }, [onPhotoMove]);

  const handlePhotoReorder = useCallback(async (roomId: string, newOrder: string[]) => {
    await onPhotoReorder(roomId, newOrder);
  }, [onPhotoReorder]);

  const handleAddPhotosForRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setIsCaptureOpen(true);
  }, []);

  // ==================== RENDER ====================

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* ========== HEADER ========== */}
      <div className="flex-shrink-0 border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-semibold text-lg">
                  État des lieux {isExitEDL ? "de sortie" : "d'entrée"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {edlData.propertyAddress}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge 
                variant={allComplete ? "default" : "outline"}
                className={allComplete ? "bg-green-500" : ""}
              >
                {completedRooms}/{rooms.length} pièces
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Sauvegarder
              </Button>
              <Button 
                size="sm" 
                onClick={handleFinalize}
                disabled={!allComplete || isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Finaliser
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{totalPhotos} photos ajoutées</span>
              <span>{Math.round(globalProgress)}% complet</span>
            </div>
            <Progress value={globalProgress} className="h-2" />
          </div>

          {/* View mode tabs */}
          <Tabs 
            value={viewMode} 
            onValueChange={(v) => setViewMode(v as ViewMode)} 
            className="mt-4"
          >
            <TabsList className="grid w-full grid-cols-4 max-w-lg mx-auto">
              <TabsTrigger value="plan" className="gap-1.5">
                <Map className="h-4 w-4" />
                <span className="hidden sm:inline">Plan</span>
              </TabsTrigger>
              <TabsTrigger value="capture" className="gap-1.5">
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Capture</span>
              </TabsTrigger>
              <TabsTrigger value="organize" className="gap-1.5">
                <Grid3X3 className="h-4 w-4" />
                <span className="hidden sm:inline">Organiser</span>
              </TabsTrigger>
              {isExitEDL && (
                <TabsTrigger value="compare" className="gap-1.5">
                  <ArrowLeftRight className="h-4 w-4" />
                  <span className="hidden sm:inline">Comparer</span>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ========== CONTENT ========== */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {/* MODE PLAN */}
            {viewMode === "plan" && (
              <motion.div
                key="plan"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="max-w-2xl mx-auto"
              >
                <div className="text-center mb-6">
                  <h2 className="text-lg font-medium">Sélectionnez une pièce</h2>
                  <p className="text-sm text-muted-foreground">
                    Cliquez sur une pièce pour y ajouter des photos
                  </p>
                </div>

                <RoomPlanSelector
                  rooms={roomsWithProgress}
                  selectedRoomId={selectedRoomId}
                  onRoomSelect={handleRoomSelect}
                />

                {/* Quick actions */}
                <div className="mt-6 flex justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setViewMode("capture")}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Capture rapide
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setViewMode("organize")}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Voir toutes les photos
                  </Button>
                </div>
              </motion.div>
            )}

            {/* MODE CAPTURE */}
            {viewMode === "capture" && (
              <motion.div
                key="capture"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="max-w-2xl mx-auto"
              >
                <div className="text-center mb-6">
                  <h2 className="text-lg font-medium">Mode capture rapide</h2>
                  <p className="text-sm text-muted-foreground">
                    Prenez plusieurs photos, assignez-les ensuite
                  </p>
                </div>

                {/* Grid rapide des pièces */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {roomsWithProgress.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => handleAddPhotosForRoom(room.id)}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left transition-all",
                        "hover:shadow-md hover:scale-[1.02]",
                        room.isComplete
                          ? "bg-green-50 border-green-200"
                          : "bg-white border-slate-200 hover:border-blue-400"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">
                          {room.type === "sejour" && "🛋️"}
                          {room.type === "cuisine" && "🍳"}
                          {room.type === "chambre" && "🛏️"}
                          {room.type === "salle_de_bain" && "🚿"}
                          {room.type === "wc" && "🚽"}
                          {room.type === "entree" && "🚪"}
                          {room.type === "balcon" && "🌿"}
                          {!["sejour", "cuisine", "chambre", "salle_de_bain", "wc", "entree", "balcon"].includes(room.type) && "📍"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {room.photoCount}/{room.requiredPhotos}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm truncate">{room.name}</p>
                    </button>
                  ))}
                </div>

                {/* Bouton capture générale */}
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={() => {
                      setSelectedRoomId(null);
                      setIsCaptureOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Camera className="h-5 w-5" />
                    Capturer des photos
                  </Button>
                </div>
              </motion.div>
            )}

            {/* MODE ORGANISER */}
            {viewMode === "organize" && (
              <motion.div
                key="organize"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <PhotoOrganizer
                  rooms={rooms.map((r) => ({
                    ...r,
                    requiredPhotos: r.requiredPhotos,
                  }))}
                  photos={photos.map((p) => ({
                    id: p.id,
                    url: p.url,
                    roomId: p.roomId,
                    isMain: p.isMain,
                    uploadedAt: p.uploadedAt,
                  }))}
                  onPhotoMove={handlePhotoMove}
                  onPhotoDelete={handlePhotoDelete}
                  onPhotoReorder={handlePhotoReorder}
                  onSetMainPhoto={onSetMainPhoto}
                  onAddPhotos={handleAddPhotosForRoom}
                />
              </motion.div>
            )}

            {/* MODE COMPARAISON (sortie uniquement) */}
            {viewMode === "compare" && isExitEDL && (
              <motion.div
                key="compare"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h2 className="text-lg font-medium">Comparaison entrée / sortie</h2>
                  <p className="text-sm text-muted-foreground">
                    Comparez l'état du logement entre l'entrée et la sortie
                  </p>
                </div>

                {rooms.map((room) => {
                  const roomEntryPhotos: ComparisonPhoto[] = entryPhotos
                    .filter((p) => p.roomId === room.id)
                    .map((p) => ({
                      id: p.id,
                      url: p.url,
                      taken_at: p.uploadedAt,
                      room_name: room.name,
                      condition: p.condition,
                    }));

                  const roomExitPhotos: ComparisonPhoto[] = photos
                    .filter((p) => p.roomId === room.id)
                    .map((p) => ({
                      id: p.id,
                      url: p.url,
                      taken_at: p.uploadedAt,
                      room_name: room.name,
                      condition: p.condition,
                    }));

                  return (
                    <EDLPhotoComparison
                      key={room.id}
                      roomName={room.name}
                      entreePhotos={roomEntryPhotos}
                      sortiePhotos={roomExitPhotos}
                      onAddSortiePhoto={() => handleAddPhotosForRoom(room.id)}
                    />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ========== MODAL CAPTURE ========== */}
      <AnimatePresence>
        {isCaptureOpen && (
          <SmartPhotoCapture
            rooms={rooms.map((r) => ({
              id: r.id,
              name: r.name,
              type: r.type,
            }))}
            initialRoomId={selectedRoomId}
            onPhotosConfirm={handlePhotosConfirm}
            onClose={() => {
              setIsCaptureOpen(false);
              setSelectedRoomId(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Loading overlay pendant upload */}
      <AnimatePresence>
        {isUploadingPhotos && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center"
          >
            <div className="bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <div className="text-center">
                <p className="font-medium">Upload en cours...</p>
                <p className="text-sm text-muted-foreground">
                  Veuillez patienter
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

