"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useBlockDates } from "@/features/seasonal/hooks/use-seasonal";

interface BlockDatesModalProps {
  listingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStartDate?: string;
}

export function BlockDatesModal({ listingId, open, onOpenChange, initialStartDate }: BlockDatesModalProps) {
  const blockDates = useBlockDates(listingId);
  const { toast } = useToast();

  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("owner_block");

  async function handleBlock(e: React.FormEvent) {
    e.preventDefault();
    try {
      await blockDates.mutateAsync({ start_date: startDate, end_date: endDate, reason });
      toast({ title: "Dates bloquées" });
      onOpenChange(false);
      setStartDate("");
      setEndDate("");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-500" />
            Bloquer des dates
          </DialogTitle>
          <DialogDescription>
            Rendre des dates indisponibles à la réservation
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleBlock} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Date début</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Date fin</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Raison (optionnel)</label>
            <Input
              placeholder="ex: travaux, usage personnel..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="destructive" disabled={blockDates.isPending}>
              {blockDates.isPending ? "En cours..." : "Bloquer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
