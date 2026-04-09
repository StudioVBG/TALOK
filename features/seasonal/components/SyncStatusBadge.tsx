"use client";

import { useState } from "react";
import { RefreshCw, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useSyncIcal } from "@/features/seasonal/hooks/use-seasonal";

interface SyncStatusBadgeProps {
  listingId: string;
}

export function SyncStatusBadge({ listingId }: SyncStatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"airbnb" | "booking">("airbnb");
  const [icalUrl, setIcalUrl] = useState("");
  const syncIcal = useSyncIcal();
  const { toast } = useToast();

  async function handleSync(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await syncIcal.mutateAsync({ listing_id: listingId, ical_url: icalUrl, platform });
      toast({
        title: "Synchronisation terminée",
        description: `${result.imported} réservation(s) importée(s), ${result.skipped} ignorée(s)`,
      });
      setOpen(false);
      setIcalUrl("");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-1" />
          Sync iCal
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Synchroniser calendrier
          </DialogTitle>
          <DialogDescription>
            Importez vos réservations depuis Airbnb ou Booking.com via leur lien iCal
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSync} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Plateforme</label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as "airbnb" | "booking")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="airbnb">Airbnb</SelectItem>
                <SelectItem value="booking">Booking.com</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">URL du calendrier iCal</label>
            <Input
              type="url"
              placeholder="https://www.airbnb.com/calendar/ical/..."
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {platform === "airbnb"
                ? "Trouvez-le dans Airbnb > Annonce > Disponibilité > Exporter le calendrier"
                : "Trouvez-le dans Booking.com > Calendrier > Synchronisation > Exporter"}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={syncIcal.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncIcal.isPending ? "animate-spin" : ""}`} />
              {syncIcal.isPending ? "Synchronisation..." : "Synchroniser"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
