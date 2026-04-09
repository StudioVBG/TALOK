"use client";

import { User, Mail, Phone, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Reservation } from "@/lib/types/seasonal";

interface GuestCardProps {
  reservation: Reservation;
}

export function GuestCard({ reservation }: GuestCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" />
          Voyageur
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{reservation.guest_name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <a href={`mailto:${reservation.guest_email}`} className="text-primary hover:underline">
            {reservation.guest_email}
          </a>
        </div>
        {reservation.guest_phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a href={`tel:${reservation.guest_phone}`} className="text-primary hover:underline">
              {reservation.guest_phone}
            </a>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{reservation.guest_count} voyageur{reservation.guest_count > 1 ? "s" : ""}</span>
        </div>
      </CardContent>
    </Card>
  );
}
