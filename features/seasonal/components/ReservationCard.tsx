"use client";

import {
  Calendar,
  User,
  Moon,
  CreditCard,
  MoreVertical,
  LogIn,
  LogOut,
  XCircle,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Reservation } from "@/lib/types/seasonal";
import { BookingSourceBadge } from "./BookingSourceBadge";

interface ReservationCardProps {
  reservation: Reservation;
  onCheckIn?: (id: string) => void;
  onCheckOut?: (id: string) => void;
  onCancel?: (id: string) => void;
  onClick?: (id: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  confirmed: { label: "Confirmée", className: "bg-green-100 text-green-800 border-green-300" },
  checked_in: { label: "En cours", className: "bg-blue-100 text-blue-800 border-blue-300" },
  checked_out: { label: "Terminée", className: "bg-gray-100 text-gray-700 border-gray-300" },
  cancelled: { label: "Annulée", className: "bg-red-100 text-red-800 border-red-300" },
  no_show: { label: "No-show", className: "bg-orange-100 text-orange-800 border-orange-300" },
};

const CLEANING_LABELS: Record<string, string> = {
  pending: "Ménage à planifier",
  scheduled: "Ménage programmé",
  done: "Ménage effectué",
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ReservationCard({
  reservation,
  onCheckIn,
  onCheckOut,
  onCancel,
  onClick,
}: ReservationCardProps) {
  const statusConfig = STATUS_CONFIG[reservation.status] ?? STATUS_CONFIG.pending;
  const canCheckIn = reservation.status === "confirmed";
  const canCheckOut = reservation.status === "checked_in";
  const canCancel = ["pending", "confirmed"].includes(reservation.status);

  return (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md",
        onClick && "cursor-pointer"
      )}
      onClick={() => onClick?.(reservation.id)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{reservation.guest_name}</p>
            <p className="text-sm text-muted-foreground">{reservation.guest_email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BookingSourceBadge source={reservation.source} />
          <Badge className={cn("text-xs", statusConfig.className)}>
            {statusConfig.label}
          </Badge>
          {(canCheckIn || canCheckOut || canCancel) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canCheckIn && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCheckIn?.(reservation.id); }}>
                    <LogIn className="mr-2 h-4 w-4" /> Check-in
                  </DropdownMenuItem>
                )}
                {canCheckOut && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCheckOut?.(reservation.id); }}>
                    <LogOut className="mr-2 h-4 w-4" /> Check-out
                  </DropdownMenuItem>
                )}
                {canCancel && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => { e.stopPropagation(); onCancel?.(reservation.id); }}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Annuler
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{formatDate(reservation.check_in)} - {formatDate(reservation.check_out)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <span>{reservation.nights} nuit{reservation.nights > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{reservation.guest_count} voyageur{reservation.guest_count > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{formatCents(reservation.total_cents)}</span>
          </div>
        </div>

        {/* Cleaning status for checked_out */}
        {reservation.status === "checked_out" && reservation.cleaning_status !== "done" && (
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-amber-600 font-medium">
              {CLEANING_LABELS[reservation.cleaning_status]}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
