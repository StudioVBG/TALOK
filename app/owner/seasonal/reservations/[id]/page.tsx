"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Moon,
  CreditCard,
  LogIn,
  LogOut,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useReservation } from "@/features/seasonal/hooks/use-seasonal";
import { GuestCard } from "@/features/seasonal/components/GuestCard";
import { CleaningScheduler } from "@/features/seasonal/components/CleaningScheduler";
import { BookingSourceBadge } from "@/features/seasonal/components/BookingSourceBadge";
import { TouristTaxCalculator } from "@/features/seasonal/components/TouristTaxCalculator";
import { CheckInForm } from "@/features/seasonal/components/CheckInForm";
import { CheckOutForm } from "@/features/seasonal/components/CheckOutForm";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmée", className: "bg-green-100 text-green-800" },
  checked_in: { label: "En cours", className: "bg-blue-100 text-blue-800" },
  checked_out: { label: "Terminée", className: "bg-gray-100 text-gray-700" },
  cancelled: { label: "Annulée", className: "bg-red-100 text-red-800" },
  no_show: { label: "No-show", className: "bg-orange-100 text-orange-800" },
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, refetch } = useReservation(id);
  const reservation = data?.reservation;

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
        <p className="text-muted-foreground">Réservation non trouvée</p>
        <Link href="/owner/seasonal/reservations">
          <Button variant="outline" className="mt-4">
            Retour
          </Button>
        </Link>
      </div>
    );
  }

  const statusConfig =
    STATUS_CONFIG[reservation.status] ?? STATUS_CONFIG.pending;
  const canCheckIn = reservation.status === "confirmed";
  const canCheckOut = reservation.status === "checked_in";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/owner/seasonal/reservations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Réservation — {reservation.guest_name}
            </h1>
            {reservation.listing && (
              <p className="text-sm text-muted-foreground">
                {reservation.listing.title}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BookingSourceBadge source={reservation.source} />
          <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
        </div>
      </div>

      {/* Action buttons */}
      {(canCheckIn || canCheckOut) && (
        <div className="flex gap-2">
          {canCheckIn && (
            <Button onClick={() => setCheckInOpen(true)}>
              <LogIn className="h-4 w-4 mr-2" /> Check-in
            </Button>
          )}
          {canCheckOut && (
            <Button onClick={() => setCheckOutOpen(true)}>
              <LogOut className="h-4 w-4 mr-2" /> Check-out
            </Button>
          )}
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Guest info */}
        <GuestCard reservation={reservation} />

        {/* Stay info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Séjour
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Arrivée</span>
              <span className="font-medium">{formatDate(reservation.check_in)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Départ</span>
              <span className="font-medium">{formatDate(reservation.check_out)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Durée</span>
              <span className="font-medium flex items-center gap-1">
                <Moon className="h-3.5 w-3.5" />
                {reservation.nights} nuit{reservation.nights > 1 ? "s" : ""}
              </span>
            </div>
            {reservation.check_in_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Check-in effectué</span>
                <span className="font-medium">
                  {new Date(reservation.check_in_at).toLocaleString("fr-FR")}
                </span>
              </div>
            )}
            {reservation.check_out_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Check-out effectué</span>
                <span className="font-medium">
                  {new Date(reservation.check_out_at).toLocaleString("fr-FR")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financial breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Détail financier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>
                {formatCents(reservation.nightly_rate_cents)} × {reservation.nights} nuit
                {reservation.nights > 1 ? "s" : ""}
              </span>
              <span>{formatCents(reservation.subtotal_cents)}</span>
            </div>
            {reservation.cleaning_fee_cents > 0 && (
              <div className="flex justify-between">
                <span>Frais de ménage</span>
                <span>{formatCents(reservation.cleaning_fee_cents)}</span>
              </div>
            )}
            {reservation.tourist_tax_cents > 0 && (
              <div className="flex justify-between">
                <span>Taxe de séjour</span>
                <span>{formatCents(reservation.tourist_tax_cents)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t font-semibold text-base">
              <span>Total</span>
              <span>{formatCents(reservation.total_cents)}</span>
            </div>
            {reservation.deposit_cents > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Caution</span>
                <span>{formatCents(reservation.deposit_cents)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cleaning scheduler */}
      {["checked_out", "checked_in"].includes(reservation.status) && (
        <CleaningScheduler
          reservation={reservation}
          onStatusChange={() => refetch()}
        />
      )}

      {/* Notes */}
      {reservation.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{reservation.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {canCheckIn && (
        <CheckInForm
          reservation={reservation}
          open={checkInOpen}
          onOpenChange={(open) => {
            setCheckInOpen(open);
            if (!open) refetch();
          }}
        />
      )}
      {canCheckOut && (
        <CheckOutForm
          reservation={reservation}
          open={checkOutOpen}
          onOpenChange={(open) => {
            setCheckOutOpen(open);
            if (!open) refetch();
          }}
        />
      )}
    </div>
  );
}
