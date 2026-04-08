"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { colocationRoomsService } from "../services/rooms.service";
import type { ColocationRoomWithOccupant } from "../types";

interface RoomEditorProps {
  propertyId: string;
  room?: ColocationRoomWithOccupant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function RoomEditor({
  propertyId,
  room,
  open,
  onOpenChange,
  onSaved,
}: RoomEditorProps) {
  const isEdit = !!room;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    room_number: room?.room_number || "",
    room_label: room?.room_label || "",
    surface_m2: room?.surface_m2?.toString() || "",
    rent_share_cents: room ? (room.rent_share_cents / 100).toString() : "",
    charges_share_cents: room ? (room.charges_share_cents / 100).toString() : "0",
    is_furnished: room?.is_furnished || false,
    description: room?.description || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const data = {
        room_number: formData.room_number,
        room_label: formData.room_label || undefined,
        surface_m2: formData.surface_m2 ? parseFloat(formData.surface_m2) : undefined,
        rent_share_cents: Math.round(parseFloat(formData.rent_share_cents) * 100),
        charges_share_cents: Math.round(parseFloat(formData.charges_share_cents || "0") * 100),
        is_furnished: formData.is_furnished,
        description: formData.description || undefined,
      };

      if (data.surface_m2 !== undefined && data.surface_m2 < 9) {
        setError("Surface minimum 9m2 par chambre (loi ELAN)");
        setSaving(false);
        return;
      }

      if (isEdit && room) {
        await colocationRoomsService.updateRoom(room.id, data);
      } else {
        await colocationRoomsService.createRoom({ ...data, property_id: propertyId });
      }

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la chambre" : "Ajouter une chambre"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="room_number">Numero *</Label>
              <Input
                id="room_number"
                value={formData.room_number}
                onChange={(e) =>
                  setFormData({ ...formData, room_number: e.target.value })
                }
                placeholder="Chambre 1"
                required
              />
            </div>
            <div>
              <Label htmlFor="room_label">Label</Label>
              <Input
                id="room_label"
                value={formData.room_label}
                onChange={(e) =>
                  setFormData({ ...formData, room_label: e.target.value })
                }
                placeholder="Grande chambre cote jardin"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="surface_m2">Surface (m2)</Label>
              <Input
                id="surface_m2"
                type="number"
                step="0.01"
                min="9"
                value={formData.surface_m2}
                onChange={(e) =>
                  setFormData({ ...formData, surface_m2: e.target.value })
                }
                placeholder="12.5"
              />
            </div>
            <div>
              <Label htmlFor="rent">Loyer (€) *</Label>
              <Input
                id="rent"
                type="number"
                step="0.01"
                min="0"
                value={formData.rent_share_cents}
                onChange={(e) =>
                  setFormData({ ...formData, rent_share_cents: e.target.value })
                }
                placeholder="450"
                required
              />
            </div>
            <div>
              <Label htmlFor="charges">Charges (€)</Label>
              <Input
                id="charges"
                type="number"
                step="0.01"
                min="0"
                value={formData.charges_share_cents}
                onChange={(e) =>
                  setFormData({ ...formData, charges_share_cents: e.target.value })
                }
                placeholder="50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is_furnished"
              checked={formData.is_furnished}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_furnished: checked })
              }
            />
            <Label htmlFor="is_furnished">Chambre meublee</Label>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Description de la chambre..."
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement..." : isEdit ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
