"use client";

import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useReservationAction } from "@/features/seasonal/hooks/use-seasonal";
import type { Reservation } from "@/lib/types/seasonal";

interface CheckInFormProps {
  reservation: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckInForm({ reservation, open, onOpenChange }: CheckInFormProps) {
  const action = useReservationAction();
  const { toast } = useToast();

  async function handleCheckIn() {
    try {
      await action.mutateAsync({ id: reservation.id, action: "check-in" });
      toast({ title: "Check-in effectué" });
      onOpenChange(false);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-green-600" />
            Check-in
          </DialogTitle>
          <DialogDescription>
            Confirmer l&apos;arrivée de {reservation.guest_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted">
            <div>
              <p className="text-muted-foreground">Voyageur</p>
              <p className="font-medium">{reservation.guest_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Voyageurs</p>
              <p className="font-medium">{reservation.guest_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Arrivée</p>
              <p className="font-medium">
                {new Date(reservation.check_in).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Départ</p>
              <p className="font-medium">
                {new Date(reservation.check_out).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleCheckIn} disabled={action.isPending}>
            <LogIn className="h-4 w-4 mr-2" />
            {action.isPending ? "En cours..." : "Confirmer le check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
