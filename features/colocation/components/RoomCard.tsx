"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildAvatarUrl } from "@/lib/helpers/format";
import { DoorOpen, Ruler, Euro, Sofa } from "lucide-react";
import type { ColocationRoomWithOccupant } from "../types";
import Link from "next/link";

interface RoomCardProps {
  room: ColocationRoomWithOccupant;
  propertyId: string;
}

export function RoomCard({ room, propertyId }: RoomCardProps) {
  const occupant = room.occupant;
  const rentEuros = (room.rent_share_cents / 100).toFixed(0);
  const chargesEuros = (room.charges_share_cents / 100).toFixed(0);

  return (
    <Link href={`/owner/properties/${propertyId}/colocation/rooms/${room.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{room.room_number}</span>
            </div>
            <Badge variant={room.is_available ? "default" : "secondary"}>
              {room.is_available ? "Disponible" : "Occupee"}
            </Badge>
          </div>

          {room.room_label && (
            <p className="text-sm text-muted-foreground mb-2">{room.room_label}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            {room.surface_m2 && (
              <span className="flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5" />
                {room.surface_m2} m2
              </span>
            )}
            <span className="flex items-center gap-1">
              <Euro className="h-3.5 w-3.5" />
              {rentEuros}€{Number(chargesEuros) > 0 ? ` + ${chargesEuros}€ ch.` : ""}
            </span>
            {room.is_furnished && (
              <span className="flex items-center gap-1">
                <Sofa className="h-3.5 w-3.5" />
                Meuble
              </span>
            )}
          </div>

          {occupant && occupant.profile && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Avatar className="h-7 w-7">
                {occupant.profile.avatar_url && (
                  <AvatarImage src={buildAvatarUrl(occupant.profile.avatar_url) ?? undefined} />
                )}
                <AvatarFallback className="text-xs">
                  {(occupant.profile.prenom?.[0] || "")}{(occupant.profile.nom?.[0] || "")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">
                {occupant.profile.prenom} {occupant.profile.nom}
              </span>
              {occupant.status === "departing" && (
                <Badge variant="destructive" className="text-xs ml-auto">
                  En depart
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
