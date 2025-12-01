"use client";
// @ts-nocheck

import { useState, useCallback } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Home, Users } from "lucide-react";
import StepFrame from "../_components/StepFrame";
import WizardFooter from "../_components/WizardFooter";
import { useNewProperty } from "../_store/useNewProperty";
import { cn } from "@/lib/utils";

type RoomType = "sejour" | "chambre" | "cuisine" | "salle_de_bain" | "wc" | "entree" | "couloir" | "balcon" | "terrasse" | "cave" | "autre";

const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: "sejour", label: "Séjour" },
  { value: "chambre", label: "Chambre" },
  { value: "cuisine", label: "Cuisine" },
  { value: "salle_de_bain", label: "Salle de bain" },
  { value: "wc", label: "WC" },
  { value: "entree", label: "Entrée" },
  { value: "couloir", label: "Couloir" },
  { value: "balcon", label: "Balcon" },
  { value: "terrasse", label: "Terrasse" },
  { value: "cave", label: "Cave" },
  { value: "autre", label: "Autre" },
];

interface Room {
  id: string;
  room_type: RoomType;
  name?: string;
  is_private?: boolean;
  sort_order: number;
}

const TEMPLATES: Record<string, Room[]> = {
  studio: [
    { id: "1", room_type: "sejour", name: "Séjour", sort_order: 1 },
    { id: "2", room_type: "cuisine", name: "Cuisine", sort_order: 2 },
    { id: "3", room_type: "salle_de_bain", name: "Salle de bain", sort_order: 3 },
    { id: "4", room_type: "wc", name: "WC", sort_order: 4 },
  ],
  t2: [
    { id: "1", room_type: "sejour", name: "Séjour", sort_order: 1 },
    { id: "2", room_type: "chambre", name: "Chambre 1", sort_order: 2 },
    { id: "3", room_type: "cuisine", name: "Cuisine", sort_order: 3 },
    { id: "4", room_type: "salle_de_bain", name: "Salle de bain", sort_order: 4 },
    { id: "5", room_type: "wc", name: "WC", sort_order: 5 },
  ],
  t3: [
    { id: "1", room_type: "sejour", name: "Séjour", sort_order: 1 },
    { id: "2", room_type: "chambre", name: "Chambre 1", sort_order: 2 },
    { id: "3", room_type: "chambre", name: "Chambre 2", sort_order: 3 },
    { id: "4", room_type: "cuisine", name: "Cuisine", sort_order: 4 },
    { id: "5", room_type: "salle_de_bain", name: "Salle de bain", sort_order: 5 },
    { id: "6", room_type: "wc", name: "WC", sort_order: 6 },
  ],
  t4: [
    { id: "1", room_type: "sejour", name: "Séjour", sort_order: 1 },
    { id: "2", room_type: "chambre", name: "Chambre 1", sort_order: 2 },
    { id: "3", room_type: "chambre", name: "Chambre 2", sort_order: 3 },
    { id: "4", room_type: "chambre", name: "Chambre 3", sort_order: 4 },
    { id: "5", room_type: "cuisine", name: "Cuisine", sort_order: 5 },
    { id: "6", room_type: "salle_de_bain", name: "Salle de bain", sort_order: 6 },
    { id: "7", room_type: "wc", name: "WC", sort_order: 7 },
  ],
};

export default function RoomsStep() {
  const { draft, patch, prev, next } = useNewProperty();
  const reduced = useReducedMotion();
  
  const [rooms, setRooms] = useState<Room[]>(
    draft.rooms?.map((r, idx) => ({
      id: r.id || `room-${idx}`,
      room_type: r.room_type as RoomType,
      name: r.name,
      is_private: r.is_private,
      sort_order: r.sort_order ?? idx,
    })) || []
  );

  const isColocation = draft.kind === "COLOCATION";

  const handleApplyTemplate = useCallback((templateKey: string) => {
    const template = TEMPLATES[templateKey];
    if (!template) return;
    
    const newRooms = template.map((r, idx) => ({
      ...r,
      id: `room-${Date.now()}-${idx}`,
      sort_order: idx + 1,
    }));
    
    setRooms(newRooms);
    patch({ rooms: newRooms });
  }, [patch]);

  const handleAddRoom = useCallback(() => {
    const newRoom: Room = {
      id: `room-${Date.now()}`,
      room_type: "sejour",
      sort_order: rooms.length + 1,
    };
    const newRooms = [...rooms, newRoom];
    setRooms(newRooms);
    patch({ rooms: newRooms });
  }, [rooms, patch]);

  const handleRemoveRoom = useCallback((id: string) => {
    const newRooms = rooms.filter((r) => r.id !== id).map((r, idx) => ({
      ...r,
      sort_order: idx + 1,
    }));
    setRooms(newRooms);
    patch({ rooms: newRooms });
  }, [rooms, patch]);

  const handleUpdateRoom = useCallback((id: string, updates: Partial<Room>) => {
    const newRooms = rooms.map((r) => (r.id === id ? { ...r, ...updates } : r));
    setRooms(newRooms);
    patch({ rooms: newRooms });
  }, [rooms, patch]);

  const handleMoveRoom = useCallback((fromIndex: number, toIndex: number) => {
    const newRooms = [...rooms];
    const [moved] = newRooms.splice(fromIndex, 1);
    newRooms.splice(toIndex, 0, moved);
    const reordered = newRooms.map((r, idx) => ({ ...r, sort_order: idx + 1 }));
    setRooms(reordered);
    patch({ rooms: reordered });
  }, [rooms, patch]);

  const canContinue = rooms.length >= 1 && 
    (!isColocation || rooms.some((r) => r.room_type === "chambre" && r.is_private === true));

  const validationError = rooms.length === 0
    ? "Au moins une pièce est requise"
    : isColocation && !rooms.some((r) => r.room_type === "chambre" && r.is_private === true)
    ? "La colocation nécessite au moins une chambre privative"
    : null;

  return (
    <StepFrame k="ROOMS">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Pièces du logement</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Définissez les pièces de votre logement pour organiser les photos et l'état des lieux
          </p>
        </div>

        {/* Templates rapides */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleApplyTemplate("studio")}
            className="text-xs"
          >
            Studio
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleApplyTemplate("t2")}
            className="text-xs"
          >
            T2
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleApplyTemplate("t3")}
            className="text-xs"
          >
            T3
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleApplyTemplate("t4")}
            className="text-xs"
          >
            T4
          </Button>
        </div>

        {/* Message colocation */}
        {isColocation && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-3 flex items-start gap-2"
          >
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Pour la colocation, au moins une chambre doit être marquée comme privative.
            </p>
          </motion.div>
        )}

        {/* Erreur de validation */}
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="rounded-lg border border-destructive bg-destructive/10 p-3"
          >
            <p className="text-sm text-destructive">{validationError}</p>
          </motion.div>
        )}

        {/* Liste des pièces */}
        <div role="list" className="space-y-3">
          <AnimatePresence mode="popLayout">
            {rooms.map((room, index) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: reduced ? 0 : 0.22 }}
                role="listitem"
                aria-label={`Pièce ${index + 1}: ${room.name || ROOM_TYPES.find((t) => t.value === room.room_type)?.label || room.room_type}`}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Drag handle */}
                      <button
                        type="button"
                        className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition"
                        aria-label={`Réordonner la pièce ${index + 1}`}
                      >
                        <GripVertical className="h-5 w-5" />
                      </button>

                      <div className="flex-1 grid gap-3 sm:grid-cols-2">
                        {/* Type de pièce */}
                        <div className="space-y-1.5">
                          <Label htmlFor={`room-type-${room.id}`}>Type de pièce</Label>
                          <Select
                            value={room.room_type}
                            onValueChange={(value) =>
                              handleUpdateRoom(room.id, { room_type: value as RoomType })
                            }
                          >
                            <SelectTrigger id={`room-type-${room.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROOM_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Nom (optionnel) */}
                        <div className="space-y-1.5">
                          <Label htmlFor={`room-name-${room.id}`}>Nom (optionnel)</Label>
                          <Input
                            id={`room-name-${room.id}`}
                            value={room.name || ""}
                            onChange={(e) =>
                              handleUpdateRoom(room.id, { name: e.target.value || undefined })
                            }
                            placeholder="Ex: Chambre 1"
                          />
                        </div>

                        {/* Privative (colocation uniquement) */}
                        {isColocation && room.room_type === "chambre" && (
                          <div className="flex items-center gap-2 pt-6">
                            <Checkbox
                              id={`room-private-${room.id}`}
                              checked={room.is_private || false}
                              onCheckedChange={(checked) =>
                                handleUpdateRoom(room.id, { is_private: checked === true })
                              }
                            />
                            <Label
                              htmlFor={`room-private-${room.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              Chambre privative
                            </Label>
                          </div>
                        )}
                      </div>

                      {/* Supprimer */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRoom(room.id)}
                        className="mt-2 text-destructive hover:text-destructive"
                        aria-label={`Supprimer la pièce ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Bouton ajouter */}
        <Button
          type="button"
          variant="outline"
          onClick={handleAddRoom}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une pièce
        </Button>

        {/* Message d'aide */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            Vous pourrez ajouter des photos et des détails pour chaque pièce à l'étape suivante.
          </p>
        </div>
      </div>

      <WizardFooter
        primary="Continuer — Photos"
        onPrimary={next}
        onBack={prev}
        disabled={!canContinue}
        hint={validationError || "Parfait, on passe aux photos 📸"}
      />
    </StepFrame>
  );
}
