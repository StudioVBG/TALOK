"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  DoorOpen,
  Ruler,
  Euro,
  Sofa,
  Calendar,
} from "lucide-react";
import { colocationRoomsService } from "@/features/colocation/services/rooms.service";
import { RoomEditor } from "@/features/colocation/components/RoomEditor";
import type { ColocationRoomWithOccupant } from "@/features/colocation/types";
import Link from "next/link";

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<ColocationRoomWithOccupant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRoom();
  }, [roomId]);

  const loadRoom = async () => {
    try {
      const rooms = await colocationRoomsService.getRooms(propertyId);
      const found = rooms.find((r) => r.id === roomId) || null;
      setRoom(found);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer cette chambre ?")) return;
    setDeleting(true);
    try {
      await colocationRoomsService.deleteRoom(roomId);
      router.push(`/owner/properties/${propertyId}/colocation/rooms`);
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
        <p className="text-muted-foreground">Chambre non trouvee</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/owner/properties/${propertyId}/colocation/rooms`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DoorOpen className="h-6 w-6" />
              {room.room_number}
            </h1>
            {room.room_label && (
              <p className="text-muted-foreground">{room.room_label}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditor(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Modifier
          </Button>
          {room.is_available && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Ruler className="h-4 w-4" /> Surface
              </span>
              <span className="font-medium">
                {room.surface_m2 ? `${room.surface_m2} m2` : "Non renseignee"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Euro className="h-4 w-4" /> Loyer
              </span>
              <span className="font-medium">
                {(room.rent_share_cents / 100).toFixed(0)}€/mois
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Euro className="h-4 w-4" /> Charges
              </span>
              <span className="font-medium">
                {(room.charges_share_cents / 100).toFixed(0)}€/mois
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Sofa className="h-4 w-4" /> Meublee
              </span>
              <Badge variant={room.is_furnished ? "default" : "secondary"}>
                {room.is_furnished ? "Oui" : "Non"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Statut</span>
              <Badge variant={room.is_available ? "default" : "secondary"}>
                {room.is_available ? "Disponible" : "Occupee"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Occupant actuel</CardTitle>
          </CardHeader>
          <CardContent>
            {room.occupant && room.occupant.profile ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {room.occupant.profile.avatar_url && (
                    <AvatarImage src={room.occupant.profile.avatar_url} />
                  )}
                  <AvatarFallback>
                    {(room.occupant.profile.prenom?.[0] || "")}{(room.occupant.profile.nom?.[0] || "")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {room.occupant.profile.prenom} {room.occupant.profile.nom}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Depuis le {new Date(room.occupant.move_in_date).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Aucun occupant
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {room.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{room.description}</p>
          </CardContent>
        </Card>
      )}

      <RoomEditor
        propertyId={propertyId}
        room={room}
        open={showEditor}
        onOpenChange={setShowEditor}
        onSaved={loadRoom}
      />
    </div>
  );
}
