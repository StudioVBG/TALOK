"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  useReservations,
  useReservationAction,
} from "@/features/seasonal/hooks/use-seasonal";
import { ReservationCard } from "@/features/seasonal/components/ReservationCard";
import { SeasonalGate } from "../SeasonalGate";

const STATUS_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmées" },
  { value: "checked_in", label: "En cours" },
  { value: "checked_out", label: "Terminées" },
  { value: "cancelled", label: "Annulées" },
];

export default function ReservationsListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const reservationAction = useReservationAction();

  const { data, isLoading } = useReservations(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const reservations = data?.reservations ?? [];

  async function handleAction(id: string, action: "check-in" | "check-out" | "cancel") {
    try {
      await reservationAction.mutateAsync({ id, action });
      toast({
        title:
          action === "check-in"
            ? "Check-in effectué"
            : action === "check-out"
            ? "Check-out effectué"
            : "Réservation annulée",
      });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Erreur",
        variant: "destructive",
      });
    }
  }

  return (
    <SeasonalGate>
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Réservations
          </h1>
          <p className="text-muted-foreground mt-1">
            Toutes vos réservations saisonnières
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : reservations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Aucune réservation
              {statusFilter !== "all" && " avec ce filtre"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              onCheckIn={(id) => handleAction(id, "check-in")}
              onCheckOut={(id) => handleAction(id, "check-out")}
              onCancel={(id) => handleAction(id, "cancel")}
              onClick={(id) => router.push(`/owner/seasonal/reservations/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
    </SeasonalGate>
  );
}
