/**
 * RoomsPhotosStep - Composant pour gérer pièces & photos V3 avec drag & drop animé
 * 
 * Sources :
 * - Modèle V3 section 2.5 : Étape 4 - Pièces & photos
 * - API existantes : app/api/properties/[id]/rooms, app/api/properties/[id]/photos
 * - Design SOTA 2025 : Drag & drop animé, preview photos, gestion pièces
 * 
 * Ce composant gère :
 * - Habitation : création/gestion pièces + upload photos par pièce
 * - Parking/Locaux : upload photos simples avec tags
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Home,
  Camera,
  Plus,
  X,
  GripVertical,
  Upload,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import type { PropertyTypeV3, RoomTypeV3, PhotoTagV3, RoomV3, PhotoV3 } from "@/lib/types/property-v3";
import { ROOM_TYPES, PHOTO_TAGS } from "@/lib/types/property-v3";
import type { Room, Photo } from "@/lib/types";
import { propertiesService } from "@/features/properties/services/properties.service";
import { useToast } from "@/components/ui/use-toast";
import { StepHeader, UnifiedSelect } from "@/lib/design-system/wizard-components";
import { containerVariants } from "@/lib/design-system/animations";

interface RoomsPhotosStepProps {
  propertyId: string;
  type_bien: PropertyTypeV3;
  nb_chambres?: number;
  nb_pieces?: number;
  rooms?: (Room | RoomV3)[];
  photos?: (Photo | PhotoV3)[];
  onRoomsChange?: (rooms: (Room | RoomV3)[]) => void;
  onPhotosChange?: (photos: (Photo | PhotoV3)[]) => void;
}

// Composant de pièce éditable
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
        {/* Handle pour drag & drop */}
        <GripVertical className="h-5 w-5 cursor-move text-muted-foreground" />

        {/* Infos pièce */}
        <div className="flex-1 space-y-3">
          {isEditing ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-foreground">Type de pièce</Label>
                  <Select
                    value={room.type_piece}
                    onValueChange={(value) => onUpdate({ type_piece: value as RoomTypeV3 })}
                  >
                    <SelectTrigger className="h-12 text-base bg-background text-foreground border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background text-foreground border-border shadow-lg">
                      {ROOM_TYPES.map((type) => (
                        <SelectItem 
                          key={type.value} 
                          value={type.value}
                          className="text-base py-3 text-foreground hover:bg-primary/10 focus:bg-primary/10 cursor-pointer"
                        >
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-foreground">Label affiché</Label>
                  <Input
                    value={room.label_affiche}
                    onChange={(e) => onUpdate({ label_affiche: e.target.value })}
                    placeholder="Ex: Chambre 1"
                    className="h-12 text-base"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-foreground">Surface (m²)</Label>
                  <Input
                    type="number"
                    value={room.surface_m2 || ""}
                    onChange={(e) => onUpdate({ surface_m2: Number(e.target.value) })}
                    placeholder="11"
                    className="h-12 text-base"
                  />
                </div>
                <div className="flex items-center gap-6">
                  <Label className="flex items-center gap-3 text-base font-medium text-foreground cursor-pointer">
                    <Checkbox
                      checked={room.chauffage_present}
                      onCheckedChange={(checked) =>
                        onUpdate({ chauffage_present: checked as boolean })
                      }
                      className="h-5 w-5"
                    />
                    Chauffage
                  </Label>
                  <Label className="flex items-center gap-3 text-base font-medium text-foreground cursor-pointer">
                    <Checkbox
                      checked={room.clim_presente}
                      onCheckedChange={(checked) =>
                        onUpdate({ clim_presente: checked as boolean })
                      }
                      className="h-5 w-5"
                    />
                    Climatisation
                  </Label>
                </div>
              </div>
              <Button size="sm" onClick={() => setIsEditing(false)}>
                Enregistrer
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {roomType && <roomType.icon className="h-6 w-6 text-primary" />}
                <h3 className="text-lg font-bold text-foreground">{room.label_affiche}</h3>
                <span className="text-base text-muted-foreground">({roomType?.label})</span>
              </div>
              <div className="flex items-center gap-4 text-base text-muted-foreground">
                {room.surface_m2 && <span>{room.surface_m2} m²</span>}
                {photosCount > 0 && <span>{photosCount} photo(s)</span>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                Modifier
              </Button>
            </>
          )}
        </div>

        {/* Bouton supprimer */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// Composant de photo avec drag & drop
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
      whileHover={{ scale: 1.05 }}
      className="relative group rounded-lg overflow-hidden border-2 border-border/50"
    >
      {photo.url ? (
        <Image src={photo.url} alt={photo.tag || "Photo"} width={400} height={128} className="h-32 w-full object-cover" />
      ) : (
        <div className="h-32 w-full bg-muted flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      {isMain && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-semibold"
        >
          Principale
        </motion.div>
      )}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {!isMain && (
          <Button size="sm" variant="secondary" onClick={onSetMain}>
            Définir comme principale
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

export function RoomsPhotosStep({
  propertyId,
  type_bien,
  nb_chambres = 0,
  nb_pieces = 0,
  rooms: initialRooms = [],
  photos: initialPhotos = [],
  onRoomsChange,
  onPhotosChange,
}: RoomsPhotosStepProps) {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<(Room | RoomV3)[]>(initialRooms as (Room | RoomV3)[]);
  const [photos, setPhotos] = useState<(Photo | PhotoV3)[]>(initialPhotos as (Photo | PhotoV3)[]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<PhotoTagV3 | null>(null);

  const isHabitation = ["appartement", "maison", "studio", "colocation"].includes(type_bien);
  const isParking = ["parking", "box"].includes(type_bien);
  const isLocalPro = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(type_bien);

  // Auto-créer pièces par défaut au premier accès
  useEffect(() => {
    if (isHabitation && rooms.length === 0 && nb_pieces > 0) {
      const defaultRooms: Partial<RoomV3>[] = [
        { type_piece: "sejour", label_affiche: "Séjour" },
        { type_piece: "cuisine", label_affiche: "Cuisine" },
        { type_piece: "salle_de_bain", label_affiche: "Salle de bain" },
        { type_piece: "wc", label_affiche: "WC" },
      ];
      if (nb_chambres >= 1) {
        for (let i = 1; i <= nb_chambres; i++) {
          defaultRooms.push({ type_piece: "chambre", label_affiche: `Chambre ${i}` });
        }
      }
      // TODO: Créer les pièces via API
    }
  }, [isHabitation, rooms.length, nb_pieces, nb_chambres]);

  const handleAddRoom = async () => {
    if (!propertyId || !propertyId.trim()) {
      console.warn(`[RoomsPhotosStep] Tentative d'ajout de pièce sans propertyId`);
      toast({
        title: "Erreur",
        description: "Le bien doit être sauvegardé avant d'ajouter des pièces",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`[RoomsPhotosStep] Ajout d'une pièce pour propertyId=${propertyId}`);
      const newRoom = await propertiesService.createRoom(propertyId, {
        type_piece: "autre" as any, // RoomTypeV3 compatible avec RoomType via cast
        label_affiche: "Nouvelle pièce",
        surface_m2: null,
        chauffage_present: true,
        clim_presente: false,
      });
      console.log(`[RoomsPhotosStep] Pièce ajoutée avec succès: id=${newRoom.id}`);
      const updatedRooms = [...rooms, newRoom];
      setRooms(updatedRooms);
      onRoomsChange?.(updatedRooms);
      
      toast({
        title: "Succès",
        description: "Pièce ajoutée avec succès",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter la pièce. Vérifiez que le bien est bien sauvegardé.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!propertyId) return;

    try {
      await propertiesService.deleteRoom(propertyId, roomId);
      const updatedRooms = rooms.filter((r) => r.id !== roomId);
      setRooms(updatedRooms);
      onRoomsChange?.(updatedRooms);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la pièce",
        variant: "destructive",
      });
    }
  };

  const handleUploadPhotos = async (files: FileList | null, roomId?: string | null, tag?: PhotoTagV3) => {
    if (!files || files.length === 0 || !propertyId) return;
    setUploading(true);

    try {
      const uploadedPhotos: Photo[] = [];

      for (const file of Array.from(files)) {
        // Obtenir URL d'upload
        const { upload_url, photo } = await propertiesService.requestPhotoUploadUrl(propertyId, {
          file_name: file.name,
          mime_type: file.type,
          room_id: roomId || undefined,
          tag: (tag as any) || undefined, // PhotoTagV3 compatible avec PhotoTag via cast
        });

        // Uploader vers Supabase Storage
        const uploadResponse = await fetch(upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Erreur upload ${file.name}`);
        }

        uploadedPhotos.push(photo);
      }

      // Mettre à jour les photos
      const updatedPhotos = [...photos, ...uploadedPhotos];
      setPhotos(updatedPhotos);
      onPhotosChange?.(updatedPhotos);

      toast({
        title: "Succès",
        description: `${uploadedPhotos.length} photo(s) ajoutée(s)`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'uploader les photos",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Synchroniser avec parent
  useEffect(() => {
    onRoomsChange?.(rooms);
  }, [rooms, onRoomsChange]);

  useEffect(() => {
    onPhotosChange?.(photos);
  }, [photos, onPhotosChange]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      {/* Titre */}
      <StepHeader
        title={isHabitation ? "Pièces & photos" : "Photos du bien"}
        description={
          isHabitation
            ? "Ajoutez les pièces et les photos associées"
            : "Ajoutez les photos du bien avec les tags appropriés"
        }
        icon={isHabitation ? <Home className="h-6 w-6 text-primary" /> : <Camera className="h-6 w-6 text-primary" />}
      />

      {/* Contenu adaptatif */}
      <AnimatePresence mode="wait">
        {isHabitation && (
          <motion.div
            key="habitation"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Section Pièces */}
            <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-foreground">
                    <Home className="h-6 w-6 text-primary" />
                    Pièces
                  </CardTitle>
                  <Button onClick={handleAddRoom} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une pièce
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <AnimatePresence>
                  {rooms.map((room, index) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      index={index}
                      photosCount={photos.filter((p) => p.room_id === room.id).length}
                      onUpdate={async (updates) => {
                        if (!propertyId) return;
                        try {
                          const updatedRoom = await propertiesService.updateRoom(
                            propertyId,
                            room.id,
                            updates as any
                          );
                          const updatedRooms = rooms.map((r) => (r.id === room.id ? updatedRoom : r));
                          setRooms(updatedRooms);
                          onRoomsChange?.(updatedRooms);
                        } catch (error: any) {
                          toast({
                            title: "Erreur",
                            description: error.message || "Impossible de mettre à jour la pièce",
                            variant: "destructive",
                          });
                        }
                      }}
                      onDelete={() => handleDeleteRoom(room.id)}
                    />
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Section Photos */}
            <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-foreground">
                  <Camera className="h-6 w-6 text-primary" />
                  Photos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sélection pièce pour upload */}
                <div className="space-y-4">
                  <UnifiedSelect
                    id="selected_room"
                    label="Ajouter des photos à une pièce"
                    value={selectedRoomId || ""}
                    onValueChange={(value) => setSelectedRoomId(value || null)}
                    options={
                      rooms.length === 0
                        ? []
                        : rooms.map((room) => ({ value: room.id, label: room.label_affiche }))
                    }
                    placeholder={rooms.length === 0 ? "Aucune pièce disponible" : "Sélectionner une pièce"}
                    disabled={rooms.length === 0}
                  />
                  <div className="flex gap-4 items-end">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) =>
                        handleUploadPhotos(e.target.files, selectedRoomId || undefined)
                      }
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!selectedRoomId || uploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? "Upload..." : "Choisir photos"}
                    </Button>
                  </div>
                </div>

                {/* Grille de photos */}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  <AnimatePresence>
                    {photos.map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        isMain={photo.is_main}
                        onSetMain={async () => {
                          try {
                            // Définir cette photo comme principale
                            await propertiesService.updatePhoto(photo.id, {
                              is_main: true,
                            });
                            // Mettre à jour les autres photos
                            const updatedPhotos = photos.map((p) => ({
                              ...p,
                              is_main: p.id === photo.id,
                            }));
                            setPhotos(updatedPhotos);
                            onPhotosChange?.(updatedPhotos);
                          } catch (error: any) {
                            toast({
                              title: "Erreur",
                              description: error.message || "Impossible de définir la photo principale",
                              variant: "destructive",
                            });
                          }
                        }}
                        onDelete={async () => {
                          try {
                            await propertiesService.deletePhoto(photo.id);
                            const updatedPhotos = photos.filter((p) => p.id !== photo.id);
                            setPhotos(updatedPhotos);
                            onPhotosChange?.(updatedPhotos);
                          } catch (error: any) {
                            toast({
                              title: "Erreur",
                              description: error.message || "Impossible de supprimer la photo",
                              variant: "destructive",
                            });
                          }
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(isParking || isLocalPro) && (
          <motion.div
            key="parking-local"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-foreground">
                  <Camera className="h-6 w-6 text-primary" />
                  Photos du bien
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload avec tag */}
                <div className="space-y-4">
                  <UnifiedSelect
                    id="photo_tag"
                    label="Tag de la photo"
                    value={selectedTag || ""}
                    onValueChange={(value) => setSelectedTag(value as PhotoTagV3)}
                    options={PHOTO_TAGS.map((tag) => ({ value: tag.value, label: tag.label }))}
                    placeholder="Sélectionner un tag"
                    required
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleUploadPhotos(e.target.files, null, selectedTag || undefined)}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!selectedTag || uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Upload..." : "Choisir photos"}
                  </Button>
                </div>

                {/* Grille de photos */}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  <AnimatePresence>
                    {photos.map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        isMain={photo.is_main}
                        onSetMain={() => {
                          setPhotos(
                            photos.map((p) => ({
                              ...p,
                              is_main: p.id === photo.id,
                            }))
                          );
                        }}
                        onDelete={() => {
                          setPhotos(photos.filter((p) => p.id !== photo.id));
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

