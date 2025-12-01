"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Home, Camera, Plus, X, GripVertical, Upload, Image as ImageIcon, Trash2, AlertCircle
} from "lucide-react";
import type { PropertyTypeV3, RoomTypeV3, PhotoTagV3, RoomV3, PhotoV3 } from "@/lib/types/property-v3";
import { ROOM_TYPES, PHOTO_TAGS } from "@/lib/types/property-v3";
import type { Room, Photo } from "@/lib/types";
import { propertiesService } from "@/features/properties/services/properties.service";
import { useToast } from "@/components/ui/use-toast";
import { UnifiedSelect } from "@/lib/design-system/wizard-components";
import { containerVariants } from "@/lib/design-system/animations";
import { WizardStepLayout } from "@/lib/design-system/wizard-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface RoomsPhotosStepProps {
  propertyId: string;
  type_bien: PropertyTypeV3;
  nb_chambres?: number;
  nb_pieces?: number;
  rooms?: (Room | RoomV3)[];
  photos?: (Photo | PhotoV3)[];
  onRoomsChange?: (rooms: (Room | RoomV3)[]) => void;
  onPhotosChange?: (photos: (Photo | PhotoV3)[]) => void;
  stepNumber?: number;
  totalSteps?: number;
  mode?: string;
  onModeChange?: (mode: any) => void;
  onBack?: () => void;
  onNext?: () => void;
  canGoNext?: boolean;
  microCopy?: string;
}

// =============================================================================
// COMPOSANTS INTERNES (RoomCard, PhotoCard)
// =============================================================================

function RoomCard({
  room,
  onUpdate,
  onDelete,
  photosCount = 0,
  index,
}: {
  room: Room | RoomV3;
  onUpdate: (updates: Partial<Room | RoomV3>) => void;
  onDelete: () => void;
  photosCount?: number;
  index: number;
}) {
  const [isEditing, setIsEditing] = useState(!room.label_affiche);
  const roomType = ROOM_TYPES.find((t) => t.value === room.type_piece as RoomTypeV3);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rounded-lg border border-border/50 bg-background/80 p-4 backdrop-blur-sm"
    >
      <div className="flex items-start gap-4">
        <GripVertical className="h-5 w-5 cursor-move text-muted-foreground mt-3" />

        <div className="flex-1 space-y-3">
          {isEditing ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type de pièce</Label>
                  <Select
                    value={room.type_piece}
                    onValueChange={(value) => onUpdate({ type_piece: value as RoomTypeV3 })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROOM_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nom affiché</Label>
                  <Input
                    value={room.label_affiche || ""}
                    onChange={(e) => onUpdate({ label_affiche: e.target.value })}
                    placeholder="Ex: Chambre 1"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 items-center">
                <div className="space-y-2">
                  <Label>Surface (m²)</Label>
                  <Input
                    type="number"
                    value={room.surface_m2 || ""}
                    onChange={(e) => onUpdate({ surface_m2: Number(e.target.value) })}
                    placeholder="Ex: 12"
                  />
                </div>
                <div className="flex gap-4 pt-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={room.chauffage_present}
                      onCheckedChange={(c) => onUpdate({ chauffage_present: !!c })}
                    /> Chauffage
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={room.clim_presente}
                      onCheckedChange={(c) => onUpdate({ clim_presente: !!c })}
                    /> Climatisation
                  </label>
                </div>
              </div>
              <Button size="sm" onClick={() => setIsEditing(false)}>Terminer</Button>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-lg flex items-center gap-2">
                  {room.label_affiche}
                  <span className="text-sm text-muted-foreground font-normal">({roomType?.label})</span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {room.surface_m2 ? `${room.surface_m2} m²` : "Surface non définie"} • {photosCount} photo(s)
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>Modifier</Button>
            </div>
          )}
        </div>

        <Button size="icon" variant="ghost" onClick={onDelete} className="text-destructive hover:bg-destructive/10">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function PhotoCard({
  photo,
  onDelete,
  onSetMain,
  isMain,
}: {
  photo: Photo | PhotoV3;
  onDelete: () => void;
  onSetMain: () => void;
  isMain: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative group rounded-lg overflow-hidden border border-border bg-muted/20"
    >
      <div className="aspect-[4/3] relative">
        {photo.url ? (
          <Image src={photo.url} alt="Photo" fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      
      {isMain && (
        <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium z-10">
          Principale
        </span>
      )}

      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {!isMain && (
          <Button size="sm" variant="secondary" onClick={onSetMain}>Principale</Button>
        )}
        <Button size="icon" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// =============================================================================
// COMPOSANT PRINCIPAL (Optimistic UI)
// =============================================================================

export function RoomsPhotosStep({
  propertyId,
  type_bien,
  nb_pieces = 0,
  nb_chambres = 0,
  rooms: initialRooms = [],
  photos: initialPhotos = [],
  onRoomsChange,
  onPhotosChange,
  stepNumber,
  totalSteps,
  mode,
  onModeChange,
  onBack,
  onNext,
  canGoNext = true,
  microCopy,
}: RoomsPhotosStepProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State local
  const [rooms, setRooms] = useState<(Room | RoomV3)[]>(initialRooms);
  const [photos, setPhotos] = useState<(Photo | PhotoV3)[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<PhotoTagV3 | null>(null);

  const isHabitation = ["appartement", "maison", "studio", "colocation"].includes(type_bien);
  const isParking = ["parking", "box"].includes(type_bien);
  const isLocalPro = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(type_bien);

  // Synchronisation initiale (si props changent depuis le parent)
  useEffect(() => {
    if (initialRooms.length > 0 && rooms.length === 0) setRooms(initialRooms);
    if (initialPhotos.length > 0 && photos.length === 0) setPhotos(initialPhotos);
  }, [initialRooms, initialPhotos]);

  // Auto-génération des pièces pour habitation si vide
  useEffect(() => {
    const initDefaultRooms = async () => {
      if (isHabitation && rooms.length === 0 && propertyId && nb_pieces > 0) {
        console.log("Génération des pièces par défaut...");
        try {
          // Création séquentielle pour éviter les conflits
          const defaults = [
            { type_piece: "sejour", label_affiche: "Séjour" },
            { type_piece: "cuisine", label_affiche: "Cuisine" },
            { type_piece: "salle_de_bain", label_affiche: "Salle de bain" },
            { type_piece: "wc", label_affiche: "WC" }
          ];
          
          // Ajouter chambres
          for(let i=1; i<=nb_chambres; i++) {
            defaults.push({ type_piece: "chambre", label_affiche: `Chambre ${i}` });
          }

          // Optimistic update local
          // (En réalité, on attend la création pour avoir les IDs, sinon on ne peut pas uploader de photos)
          // Pour simplifier : on crée côté serveur et on met à jour
          const createdRooms = [];
          for (const def of defaults) {
            const r = await propertiesService.createRoom(propertyId, {
              type_piece: def.type_piece as any,
              label_affiche: def.label_affiche,
              surface_m2: null,
              chauffage_present: true,
              clim_presente: false
            });
            createdRooms.push(r);
          }
          setRooms(createdRooms);
          onRoomsChange?.(createdRooms);
        } catch (e) {
          console.error("Erreur création pièces auto", e);
        }
      }
    };
    // Décommenter si on veut l'auto-création
    // initDefaultRooms();
  }, [isHabitation, propertyId, nb_pieces, nb_chambres]); // Retiré rooms.length pour éviter boucle

  // --- GESTION DES PIÈCES (OPTIMISTIC) ---

  const handleAddRoom = async () => {
    // 1. Optimistic UI : On ajoute une pièce "fictive" pour l'affichage immédiat
    // NOTE: Pour la création, c'est risqué car on a besoin de l'ID réel pour les photos.
    // On va plutôt afficher un état "Création..."
    try {
      const newRoom = await propertiesService.createRoom(propertyId, {
        type_piece: "autre" as any,
        label_affiche: "Nouvelle pièce",
        surface_m2: null,
        chauffage_present: true,
        clim_presente: false,
      });
      const updated = [...rooms, newRoom as Room | RoomV3];
      setRooms(updated);
      onRoomsChange?.(updated);
      toast({ title: "Pièce ajoutée" });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter la pièce", variant: "destructive" });
    }
  };

  const handleUpdateRoom = async (id: string, updates: Partial<Room | RoomV3>) => {
    // 1. Optimistic Update
    const oldRooms = [...rooms];
    const updatedRooms = rooms.map(r => r.id === id ? { ...r, ...updates } : r) as (Room | RoomV3)[];
    setRooms(updatedRooms);
    onRoomsChange?.(updatedRooms);

    // 2. Sync Background
    try {
      // Debounce manuel ou appel direct
      await propertiesService.updateRoom(propertyId, id, updates as any);
    } catch (error) {
      // Rollback
      setRooms(oldRooms);
      onRoomsChange?.(oldRooms);
      toast({ title: "Erreur", description: "Échec de la modification", variant: "destructive" });
    }
  };

  const handleDeleteRoom = async (id: string) => {
    // 1. Optimistic Delete
    const oldRooms = [...rooms];
    const updatedRooms = rooms.filter(r => r.id !== id);
    setRooms(updatedRooms);
    onRoomsChange?.(updatedRooms);

    // 2. Sync Background
    try {
      await propertiesService.deleteRoom(propertyId, id);
    } catch (error) {
      // Rollback
      setRooms(oldRooms);
      onRoomsChange?.(oldRooms);
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    }
  };

  // --- GESTION DES PHOTOS ---

  const handleUpload = async (files: FileList | null) => {
    if (!files || !propertyId) return;
    setUploading(true);

    try {
      const newPhotos: Photo[] = [];
      // On upload séquentiellement ou en parallèle
      for (const file of Array.from(files)) {
        const { upload_url, photo } = await propertiesService.requestPhotoUploadUrl(propertyId, {
          file_name: file.name,
          mime_type: file.type,
          room_id: selectedRoomId || undefined,
          tag: (selectedTag as any) || undefined,
        });

        await fetch(upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        newPhotos.push(photo);
      }

      const updated = [...photos, ...newPhotos];
      setPhotos(updated);
      onPhotosChange?.(updated);
      toast({ title: "Photos ajoutées", description: `${newPhotos.length} photo(s)` });
    } catch (error) {
      toast({ title: "Erreur upload", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    const oldPhotos = [...photos];
    setPhotos(photos.filter(p => p.id !== id)); // Optimistic
    onPhotosChange?.(photos.filter(p => p.id !== id));

    try {
      await propertiesService.deletePhoto(id);
    } catch (error) {
      setPhotos(oldPhotos); // Rollback
      onPhotosChange?.(oldPhotos);
      toast({ title: "Erreur suppression", variant: "destructive" });
    }
  };

  const handleSetMainPhoto = async (id: string) => {
    const oldPhotos = [...photos];
    // Optimistic
    const updated = photos.map(p => ({ ...p, is_main: p.id === id }));
    setPhotos(updated);
    onPhotosChange?.(updated);

    try {
      await propertiesService.updatePhoto(id, { is_main: true });
    } catch (error) {
      setPhotos(oldPhotos);
      onPhotosChange?.(oldPhotos);
    }
  };

  // --- RENDU ---

  if (!propertyId) {
    return (
      <WizardStepLayout 
        title="Erreur" 
        description="Propriété non identifiée"
        stepNumber={stepNumber ?? 1}
        totalSteps={totalSteps ?? 1}
        progressValue={0}
      >
        <Alert variant="destructive"><AlertTitle>Erreur critique</AlertTitle><AlertDescription>ID manquant</AlertDescription></Alert>
      </WizardStepLayout>
    );
  }

  return (
    <WizardStepLayout
      title={isHabitation ? "Pièces & Photos" : "Photos du bien"}
      description="Organisez votre bien"
      stepNumber={stepNumber ?? 1}
      totalSteps={totalSteps ?? 1}
      progressValue={((stepNumber ?? 1) / (totalSteps ?? 1)) * 100}
      onBack={onBack}
      onNext={onNext}
      canGoNext={canGoNext}
      microCopy={microCopy}
    >
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
        
        {/* SECTION PIÈCES (Habitation seulement) */}
        {isHabitation && (
          <Card className="bg-muted/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Home className="w-5 h-5" /> Pièces ({rooms.length})</CardTitle>
              <Button size="sm" onClick={handleAddRoom}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence mode="popLayout">
                {rooms.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-muted-foreground">
                    Aucune pièce. Ajoutez-en une pour commencer.
                  </motion.div>
                )}
                {rooms.map((room, idx) => (
                  <RoomCard
                    key={room.id}
                    index={idx}
                    room={room}
                    photosCount={photos.filter(p => p.room_id === room.id).length}
                    onUpdate={(u) => handleUpdateRoom(room.id, u)}
                    onDelete={() => handleDeleteRoom(room.id)}
                  />
                ))}
              </AnimatePresence>
            </CardContent>
          </Card>
        )}

        {/* SECTION PHOTOS */}
        <Card className="bg-muted/30">
          <CardHeader><CardTitle className="flex items-center gap-2"><Camera className="w-5 h-5" /> Photos ({photos.length})</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            
            {/* Upload Controls */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-background rounded-lg border border-border border-dashed">
              {isHabitation ? (
                <div className="flex-1">
                  <Label className="mb-2 block">Lier à une pièce (Optionnel)</Label>
                  <UnifiedSelect
                    id="room-select"
                    label="Pièce associée"
                    value={selectedRoomId || ""}
                    onValueChange={setSelectedRoomId}
                    options={rooms.map(r => ({ value: r.id, label: r.label_affiche || "Pièce" }))}
                    placeholder="Choisir une pièce..."
                  />
                </div>
              ) : (
                <div className="flex-1">
                  <Label className="mb-2 block">Tag</Label>
                  <UnifiedSelect
                    id="photo-tag-select"
                    label="Tag photo"
                    value={selectedTag || ""}
                    onValueChange={(v) => setSelectedTag(v as PhotoTagV3)}
                    options={PHOTO_TAGS.map(t => ({ value: t.value, label: t.label }))}
                    placeholder="Tag..."
                  />
                </div>
              )}
              
              <div className="flex items-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={uploading}
                  className="w-full sm:w-auto"
                >
                  {uploading ? <span className="animate-pulse">Upload...</span> : <><Upload className="w-4 h-4 mr-2" /> Ajouter photos</>}
                </Button>
              </div>
            </div>

            {/* Gallery */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence>
                {photos.map(photo => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    isMain={!!photo.is_main}
                    onDelete={() => handleDeletePhoto(photo.id)}
                    onSetMain={() => handleSetMainPhoto(photo.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

      </motion.div>
    </WizardStepLayout>
  );
}
