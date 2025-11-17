/**
 * PropertyRoomsPhotosTab - Tab "Pièces & photos"
 * Liste des rooms à gauche, galerie à droite, photos non classées
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Camera, Plus, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import type { Property, Room, Photo } from "@/lib/types";
import { propertiesService } from "@/features/properties/services/properties.service";
import { useToast } from "@/components/ui/use-toast";

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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  async function fetchData() {
    try {
      setLoading(true);
      // TODO: Utiliser les hooks useRooms et usePhotos quand disponibles
      const propertyData = await propertiesService.getPropertyById(propertyId);
      // Les rooms et photos devraient être dans la réponse de l'API
      // Pour l'instant, on utilise des tableaux vides
      setRooms([]);
      setPhotos([]);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les données.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedRoomPhotos = selectedRoomId
    ? photos.filter((p) => p.room_id === selectedRoomId)
    : photos.filter((p) => !p.room_id);

  const unclassifiedPhotos = photos.filter((p) => !p.room_id);

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
                  <Image src={photo.url} alt="Photo" fill className="object-cover" />
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
              <Button size="sm" variant="outline">
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
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

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
                    <Image src={photo.url} alt="Photo non classée" fill className="object-cover" />
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
                    <Image src={photo.url} alt="Photo" fill className="object-cover" />
                    {photo.is_main && (
                      <Badge className="absolute top-2 right-2" variant="default">
                        Principale
                      </Badge>
                    )}
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

