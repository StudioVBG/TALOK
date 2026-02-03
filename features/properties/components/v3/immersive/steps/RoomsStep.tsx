"use client";

import React, { useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Bed, Bath, ChefHat, Sofa, Box, Warehouse, Store, Car, Shirt, Monitor, UtensilsCrossed, Armchair, LayoutGrid, Baby, Layers, Wine, BedDouble } from "lucide-react";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Badge } from "@/components/ui/badge";
import { SmartRoomSuggestions } from "../SmartRoomSuggestions";
import type { RoomTypeV3, PropertyTypeV3 } from "@/lib/types/property-v3";

const MAIN_ROOM_TYPES = ["chambre", "sejour", "bureau", "salon_cuisine", "salon_sam", "open_space", "suite_parentale", "mezzanine"];
const BEDROOM_TYPES = ["chambre", "suite_parentale", "suite_enfant"];

interface RoomPreset { id: string; label: string; icon: React.ElementType; }

const HABITATION_PRESETS: RoomPreset[] = [
  { id: "chambre", label: "Chambre", icon: Bed },
  { id: "sejour", label: "Séjour", icon: Sofa },
  { id: "salon_cuisine", label: "Salon/Cuisine", icon: UtensilsCrossed },
  { id: "cuisine", label: "Cuisine", icon: ChefHat },
  { id: "salle_de_bain", label: "SDB", icon: Bath },
  { id: "wc", label: "WC", icon: Bath },
  { id: "bureau", label: "Bureau", icon: Monitor },
  { id: "dressing", label: "Dressing", icon: Shirt },
  { id: "suite_parentale", label: "Suite", icon: BedDouble },
  { id: "mezzanine", label: "Mezzanine", icon: Layers },
  { id: "buanderie", label: "Buanderie", icon: Shirt },
  { id: "cellier", label: "Cellier", icon: Wine },
  { id: "balcon", label: "Balcon", icon: Sofa },
  { id: "terrasse", label: "Terrasse", icon: Sofa },
  { id: "cave", label: "Cave", icon: Box },
];

const PRO_PRESETS: RoomPreset[] = [
  { id: "sejour", label: "Principal", icon: Store },
  { id: "bureau", label: "Bureau", icon: Monitor },
  { id: "stockage", label: "Stockage", icon: Warehouse },
  { id: "cuisine", label: "Cuisine", icon: ChefHat },
  { id: "wc", label: "WC", icon: Bath },
  { id: "autre", label: "Autre", icon: Box },
];

const PARKING_PRESETS: RoomPreset[] = [
  { id: "emplacement", label: "Emplacement", icon: Car },
  { id: "box", label: "Box", icon: Box },
];

export function RoomsStep() {
  const { rooms, addRoom, removeRoom, formData } = usePropertyWizardStore();

  const presets = useMemo(() => {
    const type = formData.type as PropertyTypeV3 | undefined;
    if (type === 'parking' || type === 'box') return PARKING_PRESETS;
    if (['local_commercial', 'bureaux', 'entrepot', 'fonds_de_commerce'].includes(type || '')) return PRO_PRESETS;
    return HABITATION_PRESETS;
  }, [formData.type]);

  const getNumberedLabel = useCallback((typePiece: string, baseLabel: string) => {
    const existingCount = rooms.filter(r => r.type_piece === typePiece).length;
    const multipleTypes = ["chambre", "salle_de_bain", "wc", "bureau", "balcon", "terrasse"];
    if (multipleTypes.includes(typePiece) || existingCount > 0) return `${baseLabel} ${existingCount + 1}`;
    return baseLabel;
  }, [rooms]);

  const roomCounts = useMemo(() => ({
    nbPieces: rooms.filter(r => MAIN_ROOM_TYPES.includes(r.type_piece)).length,
    nbChambres: rooms.filter(r => BEDROOM_TYPES.includes(r.type_piece)).length,
    total: rooms.length
  }), [rooms]);

  const getPresetCount = useCallback((presetId: string) => rooms.filter(r => r.type_piece === presetId).length, [rooms]);
  const getRoomIcon = useCallback((typePiece: string) => presets.find(p => p.id === typePiece)?.icon || Box, [presets]);

  const handleAddRoom = useCallback((preset: RoomPreset) => {
    addRoom({ type_piece: preset.id as any, label_affiche: getNumberedLabel(preset.id, preset.label) });
  }, [addRoom, getNumberedLabel]);

  return (
    <div className="h-full flex flex-col">
      {/* Suggestions intelligentes si aucune pièce */}
      {rooms.length === 0 && (
        <div className="flex-shrink-0 mb-4">
          <SmartRoomSuggestions />
        </div>
      )}

      {/* Badges récapitulatif */}
      <div className="flex-shrink-0 flex flex-wrap gap-2 mb-4">
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">{roomCounts.nbPieces} pièce{roomCounts.nbPieces > 1 ? 's' : ''}</Badge>
        <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">{roomCounts.nbChambres} chambre{roomCounts.nbChambres > 1 ? 's' : ''}</Badge>
      </div>

      {/* Grille presets - Responsive */}
      <div className="flex-shrink-0 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mb-4">
        {presets.map((preset) => {
          const count = getPresetCount(preset.id);
          const PresetIcon = preset.icon;
          return (
            <motion.button
              key={preset.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAddRoom(preset)}
              className="relative flex flex-col items-center p-2 md:p-3 rounded-lg bg-card border hover:border-primary/50 hover:shadow-sm transition-all"
            >
              {count > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                  {count}
                </span>
              )}
              <PresetIcon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground mb-1" />
              <span className="text-[9px] md:text-[10px] font-medium text-center leading-tight truncate w-full">{preset.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Liste pièces - Scrollable si nécessaire */}
      <div className="flex-1 min-h-0 bg-muted/30 rounded-xl p-3 overflow-y-auto">
        {rooms.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-center text-sm text-muted-foreground">Cliquez ci-dessus pour ajouter des pièces</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {rooms.map((room, index) => {
                const RoomIcon = getRoomIcon(room.type_piece);
                return (
                  <motion.div
                    key={room.id || index}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="group flex items-center gap-2 bg-background px-3 py-2 rounded-lg border text-sm"
                  >
                    <RoomIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{room.label_affiche}</span>
                    <button
                      onClick={() => removeRoom(room.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
