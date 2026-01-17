/**
 * PropertyRoomsPhotosTab - Tab "Pièces & photos"
 * Liste des rooms à gauche, galerie à droite, photos non classées
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Camera, Plus, CheckCircle2, AlertCircle, Image as ImageIcon, Upload, Trash2, X } from "lucide-react";
import Image from "next/image";
import type { Property, Room, Photo } from "@/lib/types";
import { propertiesService } from "@/features/properties/services/properties.service";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRooms, useCreateRoom, useDeleteRoom } from "@/lib/hooks/use-rooms";
import { usePhotos, useUpdatePhoto, useDeletePhoto } from "@/lib/hooks/use-photos";

interface PropertyRoomsPhotosTabProps {
  propertyId: string;
  property: Property;
  isHabitation: boolean;
}

export function PropertyRoomsPhotosTab({
  propertyId,
  property,
  isHabitation,
}: PropertyRoomsPhotosTabProps) {
  const { toast } = useToast();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Utiliser React Query pour les rooms et photos
  const { data: rooms = [], isLoading: roomsLoading, error: roomsError } = useRooms(propertyId);
  const { data: photos = [], isLoading: photosLoading, error: photosError } = usePhotos(propertyId);
  
  const queryClient = useQueryClient();
  const createRoom = useCreateRoom();
  const deleteRoomMutation = useDeleteRoom();
  const updatePhotoMutation = useUpdatePhoto();
  const deletePhotoMutation = useDeletePhoto();

  const loading = roomsLoading || photosLoading;

  // Sélectionner automatiquement la première pièce s'il y en a
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  // Gérer les erreurs
  useEffect(() => {
    if (roomsError || photosError) {
      const error = roomsError || photosError;
      console.error("[PropertyRoomsPhotosTab] Erreur:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger les données.",
        variant: "destructive",
      });
    }
  }, [roomsError, photosError, toast]);

  const selectedRoomPhotos = selectedRoomId
    ? photos.filter((p) => p.room_id === selectedRoomId)
    : photos.filter((p) => !p.room_id);

  const unclassifiedPhotos = photos.filter((p) => !p.room_id);
  
  const handleAddRoom = async () => {
    try {
      const newRoom = await createRoom.mutateAsync({
        propertyId,
        data: {
          type_piece: "autre" as any,
          label_affiche: "Nouvelle pièce",
          surface_m2: null,
          chauffage_present: true,
          clim_presente: false,
        },
      });
      toast({
        title: "Succès",
        description: "Pièce ajoutée avec succès",
      });
      setSelectedRoomId(newRoom.id);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'ajouter la pièce",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      await deleteRoomMutation.mutateAsync({ propertyId, roomId });
      toast({
        title: "Succès",
        description: "Pièce supprimée",
      });
      if (selectedRoomId === roomId) {
        setSelectedRoomId(null);
      }
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer la pièce",
        variant: "destructive",
      });
    }
  };

  const handleUploadPhotos = async (files: FileList | null, roomId?: string | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const { upload_url, photo } = await propertiesService.requestPhotoUploadUrl(propertyId, {
          file_name: file.name,
          mime_type: file.type,
          room_id: roomId || undefined,
          // Si pas de room_id, ajouter un tag par défaut pour les photos sans pièce
          tag: roomId ? undefined : "vue_generale",
        } as any);

        const uploadResponse = await fetch(upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Erreur upload ${file.name}`);
        }
      }

      toast({
        title: "Succès",
        description: `${files.length} photo(s) ajoutée(s)`,
      });
      // Invalider le cache React Query pour rafraîchir les photos
      queryClient.invalidateQueries({ queryKey: ["photos", propertyId] });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'uploader les photos",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (!isHabitation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Photos du bien
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-8">
                Aucune photo pour le moment
              </p>
            ) : (
              photos.map((photo) => (
                <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border">
                  <Image src={photo.url} alt="Photo" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Liste des rooms à gauche */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                Pièces
              </CardTitle>
              <Button size="sm" variant="outline" onClick={handleAddRoom}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune pièce pour le moment
              </p>
            ) : (
              rooms.map((room) => {
                const roomPhotos = photos.filter((p) => p.room_id === room.id);
                const hasPhotos = roomPhotos.length > 0;
                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedRoomId === room.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{room.label_affiche}</span>
                      <Badge variant={hasPhotos ? "default" : "secondary"} className="text-xs">
                        {hasPhotos ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {roomPhotos.length}
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            0
                          </>
                        )}
                      </Badge>
                    </div>
                    {room.surface_m2 && (
                      <p className="text-xs text-muted-foreground mt-1">{room.surface_m2} m²</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRoom(room.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Upload de photos */}
        {isHabitation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ajouter des photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  {selectedRoomId
                    ? `Photos pour ${rooms.find((r) => r.id === selectedRoomId)?.label_affiche || "cette pièce"}`
                    : "Photos générales"}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUploadPhotos(e.target.files, selectedRoomId)}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full"
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Upload en cours..." : "Choisir des photos"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photos non classées */}
        {unclassifiedPhotos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Photos non classées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {unclassifiedPhotos.slice(0, 4).map((photo) => (
                  <div key={photo.id} className="relative aspect-square rounded overflow-hidden border">
                    <Image src={photo.url} alt="Photo non classée" fill sizes="100px" className="object-cover" />
                  </div>
                ))}
              </div>
              {unclassifiedPhotos.length > 4 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  +{unclassifiedPhotos.length - 4} autres
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Galerie de la pièce sélectionnée à droite */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              {selectedRoomId
                ? rooms.find((r) => r.id === selectedRoomId)?.label_affiche || "Pièce"
                : "Toutes les photos"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {selectedRoomPhotos.length === 0 ? (
                <p className="col-span-full text-center text-muted-foreground py-8">
                  {selectedRoomId ? "Aucune photo pour cette pièce" : "Aucune photo"}
                </p>
              ) : (
                selectedRoomPhotos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border group">
                    <Image src={photo.url} alt="Photo" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
                    {photo.is_main && (
                      <Badge className="absolute top-2 right-2 z-10" variant="default">
                        Principale
                      </Badge>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-2">
                        {!photo.is_main && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              try {
                                await updatePhotoMutation.mutateAsync({
                                  photoId: photo.id,
                                  data: { is_main: true },
                                });
                                toast({
                                  title: "Succès",
                                  description: "Photo définie comme principale",
                                });
                              } catch (error: unknown) {
                                toast({
                                  title: "Erreur",
                                  description: error instanceof Error ? error.message : "Impossible de définir la photo principale",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            try {
                              await deletePhotoMutation.mutateAsync(photo.id);
                              toast({
                                title: "Succès",
                                description: "Photo supprimée",
                              });
                            } catch (error: unknown) {
                              toast({
                                title: "Erreur",
                                description: error instanceof Error ? error.message : "Impossible de supprimer la photo",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

