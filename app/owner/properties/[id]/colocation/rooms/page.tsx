"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowLeft } from "lucide-react";
import { colocationRoomsService } from "@/features/colocation/services/rooms.service";
import { RoomCard } from "@/features/colocation/components/RoomCard";
import { RoomEditor } from "@/features/colocation/components/RoomEditor";
import type { ColocationRoomWithOccupant } from "@/features/colocation/types";
import Link from "next/link";

export default function ColocationRoomsPage() {
  const params = useParams();
  const propertyId = params.id as string;
  const [rooms, setRooms] = useState<ColocationRoomWithOccupant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    loadRooms();
  }, [propertyId]);

  const loadRooms = async () => {
    try {
      const data = await colocationRoomsService.getRooms(propertyId);
      setRooms(data);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/owner/properties/${propertyId}/colocation`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Chambres ({rooms.length})</h1>
        </div>
        <Button onClick={() => setShowEditor(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une chambre
        </Button>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">
            Aucune chambre configuree pour cette colocation.
          </p>
          <Button onClick={() => setShowEditor(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Creer la premiere chambre
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} propertyId={propertyId} />
          ))}
        </div>
      )}

      <RoomEditor
        propertyId={propertyId}
        open={showEditor}
        onOpenChange={setShowEditor}
        onSaved={loadRooms}
      />
    </div>
  );
}
