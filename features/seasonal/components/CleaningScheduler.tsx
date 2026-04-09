"use client";

import { Sparkles, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import type { Reservation, CleaningStatus } from "@/lib/types/seasonal";

const STATUS_CONFIG: Record<CleaningStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "À planifier", icon: Clock, className: "bg-yellow-100 text-yellow-800" },
  scheduled: { label: "Programmé", icon: Sparkles, className: "bg-blue-100 text-blue-800" },
  done: { label: "Effectué", icon: CheckCircle, className: "bg-green-100 text-green-800" },
};

interface CleaningSchedulerProps {
  reservation: Reservation;
  onStatusChange?: (status: CleaningStatus) => void;
}

export function CleaningScheduler({ reservation, onStatusChange }: CleaningSchedulerProps) {
  const { toast } = useToast();
  const config = STATUS_CONFIG[reservation.cleaning_status];
  const Icon = config.icon;

  async function updateCleaningStatus(newStatus: CleaningStatus) {
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleaning_status: newStatus }),
      });
      if (!res.ok) throw new Error("Erreur mise à jour");
      toast({ title: `Ménage : ${STATUS_CONFIG[newStatus].label}` });
      onStatusChange?.(newStatus);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Ménage
          </span>
          <Badge className={config.className}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {reservation.cleaning_status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateCleaningStatus("scheduled")}
            >
              Planifier le ménage
            </Button>
          )}
          {reservation.cleaning_status === "scheduled" && (
            <Button
              size="sm"
              onClick={() => updateCleaningStatus("done")}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Marquer comme effectué
            </Button>
          )}
          {reservation.cleaning_status === "done" && (
            <p className="text-sm text-green-600 font-medium">
              Le ménage a été effectué
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
