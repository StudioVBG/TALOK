"use client";

import { LogOut } from "lucide-react";
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

interface CheckOutFormProps {
  reservation: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckOutForm({ reservation, open, onOpenChange }: CheckOutFormProps) {
  const action = useReservationAction();
  const { toast } = useToast();

  async function handleCheckOut() {
    try {
      await action.mutateAsync({ id: reservation.id, action: "check-out" });
      toast({ title: "Check-out effectué" });
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
            <LogOut className="h-5 w-5 text-blue-600" />
            Check-out
          </DialogTitle>
          <DialogDescription>
            Confirmer le départ de {reservation.guest_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted">
            <div>
              <p className="text-muted-foreground">Voyageur</p>
              <p className="font-medium">{reservation.guest_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Séjour</p>
              <p className="font-medium">{reservation.nights} nuit{reservation.nights > 1 ? "s" : ""}</p>
            </div>
          </div>

          <p className="text-muted-foreground">
            Le ménage sera automatiquement planifié si un prestataire est assigné.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleCheckOut} disabled={action.isPending}>
            <LogOut className="h-4 w-4 mr-2" />
            {action.isPending ? "En cours..." : "Confirmer le check-out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
