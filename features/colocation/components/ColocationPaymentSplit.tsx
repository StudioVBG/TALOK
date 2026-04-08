"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Euro } from "lucide-react";
import type { ColocationRoomWithOccupant } from "../types";

interface ColocationPaymentSplitProps {
  rooms: ColocationRoomWithOccupant[];
  totalRentCents: number;
}

export function ColocationPaymentSplit({
  rooms,
  totalRentCents,
}: ColocationPaymentSplitProps) {
  const occupiedRooms = rooms.filter((r) => !r.is_available);
  const totalFromRooms = rooms.reduce((acc, r) => acc + r.rent_share_cents, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Euro className="h-5 w-5" />
          Repartition du loyer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rooms.map((room) => {
            const percentage =
              totalFromRooms > 0
                ? (room.rent_share_cents / totalFromRooms) * 100
                : 0;
            const rentEuros = (room.rent_share_cents / 100).toFixed(0);
            const occupant = room.occupant?.profile;

            return (
              <div key={room.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{room.room_number}</span>
                  <span className="text-muted-foreground">
                    {rentEuros}€ ({percentage.toFixed(0)}%)
                    {occupant && (
                      <span className="ml-2">
                        - {occupant.prenom} {occupant.nom}
                      </span>
                    )}
                  </span>
                </div>
                <Progress
                  value={percentage}
                  className={`h-2 ${room.is_available ? "opacity-40" : ""}`}
                />
              </div>
            );
          })}

          <div className="pt-3 border-t flex items-center justify-between text-sm font-medium">
            <span>Total</span>
            <span>{(totalFromRooms / 100).toFixed(0)}€</span>
          </div>

          {totalRentCents > 0 && totalFromRooms !== totalRentCents && (
            <p className="text-xs text-amber-600 mt-1">
              Attention : la somme des loyers par chambre ({(totalFromRooms / 100).toFixed(0)}€)
              ne correspond pas au loyer total du bien ({(totalRentCents / 100).toFixed(0)}€)
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
