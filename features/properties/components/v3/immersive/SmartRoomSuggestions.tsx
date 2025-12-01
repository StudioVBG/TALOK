"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, Home, Bed, Bath, ChefHat, Sofa, Briefcase } from "lucide-react";
import type { RoomTypeV3, PropertyTypeV3 } from "@/lib/types/property-v3";

interface RoomSuggestion {
  type_piece: RoomTypeV3;
  label: string;
  icon: React.ElementType;
}

// Suggestions intelligentes par type de bien
const SMART_SUGGESTIONS: Record<string, RoomSuggestion[]> = {
  appartement: [
    { type_piece: "sejour", label: "Séjour", icon: Sofa },
    { type_piece: "cuisine", label: "Cuisine", icon: ChefHat },
    { type_piece: "chambre", label: "Chambre 1", icon: Bed },
    { type_piece: "salle_de_bain", label: "Salle de bain", icon: Bath },
    { type_piece: "wc", label: "WC", icon: Bath },
  ],
  studio: [
    { type_piece: "salon_cuisine", label: "Pièce principale", icon: Sofa },
    { type_piece: "salle_eau", label: "Salle d'eau", icon: Bath },
    { type_piece: "wc", label: "WC", icon: Bath },
  ],
  maison: [
    { type_piece: "sejour", label: "Séjour", icon: Sofa },
    { type_piece: "cuisine", label: "Cuisine", icon: ChefHat },
    { type_piece: "chambre", label: "Chambre 1", icon: Bed },
    { type_piece: "chambre", label: "Chambre 2", icon: Bed },
    { type_piece: "chambre", label: "Chambre 3", icon: Bed },
    { type_piece: "salle_de_bain", label: "Salle de bain", icon: Bath },
    { type_piece: "wc", label: "WC", icon: Bath },
  ],
  colocation: [
    { type_piece: "chambre", label: "Chambre 1", icon: Bed },
    { type_piece: "chambre", label: "Chambre 2", icon: Bed },
    { type_piece: "chambre", label: "Chambre 3", icon: Bed },
    { type_piece: "salon_cuisine", label: "Cuisine/Salon commun", icon: Sofa },
    { type_piece: "salle_de_bain", label: "SDB 1", icon: Bath },
    { type_piece: "salle_de_bain", label: "SDB 2", icon: Bath },
    { type_piece: "wc", label: "WC", icon: Bath },
  ],
  saisonnier: [
    { type_piece: "salon_cuisine", label: "Salon/Cuisine", icon: Sofa },
    { type_piece: "chambre", label: "Chambre", icon: Bed },
    { type_piece: "salle_de_bain", label: "Salle de bain", icon: Bath },
    { type_piece: "terrasse", label: "Terrasse", icon: Sofa },
  ],
  local_commercial: [
    { type_piece: "sejour", label: "Espace principal", icon: Home },
    { type_piece: "stockage", label: "Réserve", icon: Home },
    { type_piece: "wc", label: "WC", icon: Bath },
  ],
  bureaux: [
    { type_piece: "bureau", label: "Bureau 1", icon: Briefcase },
    { type_piece: "bureau", label: "Bureau 2", icon: Briefcase },
    { type_piece: "sejour", label: "Open space", icon: Sofa },
    { type_piece: "cuisine", label: "Kitchenette", icon: ChefHat },
    { type_piece: "wc", label: "WC", icon: Bath },
  ],
};

interface SmartRoomSuggestionsProps {
  onApply?: () => void;
}

export function SmartRoomSuggestions({ onApply }: SmartRoomSuggestionsProps) {
  const { formData, rooms, addRoom } = usePropertyWizardStore();

  const propertyType = formData.type as PropertyTypeV3 | undefined;
  const suggestions = useMemo(() => {
    if (!propertyType) return null;
    return SMART_SUGGESTIONS[propertyType] || null;
  }, [propertyType]);

  // Ne pas afficher si des pièces existent déjà
  const shouldShow = rooms.length === 0 && suggestions && suggestions.length > 0;

  const handleApplySuggestions = () => {
    if (!suggestions) return;
    
    suggestions.forEach((suggestion) => {
      addRoom({
        type_piece: suggestion.type_piece,
        label_affiche: suggestion.label,
      });
    });
    
    onApply?.();
  };

  if (!shouldShow) return null;

  const typeLabel = {
    appartement: "appartement",
    studio: "studio",
    maison: "maison",
    colocation: "colocation",
    saisonnier: "location saisonnière",
    local_commercial: "local commercial",
    bureaux: "bureaux",
  }[propertyType || ""] || "ce type de bien";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-950/30 dark:via-purple-950/30 dark:to-fuchsia-950/30 rounded-xl p-4 border border-violet-200 dark:border-violet-800 shadow-sm"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20">
          <Wand2 className="h-5 w-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-violet-900 dark:text-violet-100 mb-1">
            Configuration rapide
          </h4>
          <p className="text-xs text-violet-700 dark:text-violet-300 mb-3">
            Ajouter automatiquement les pièces typiques d&apos;un {typeLabel} :
          </p>

          {/* Preview chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {suggestions.slice(0, 6).map((suggestion, idx) => {
              const Icon = suggestion.icon;
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/60 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-medium shadow-sm"
                >
                  <Icon className="h-3 w-3" />
                  {suggestion.label}
                </span>
              );
            })}
            {suggestions.length > 6 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-white/60 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[10px]">
                +{suggestions.length - 6} autres
              </span>
            )}
          </div>

          {/* Action */}
          <Button
            onClick={handleApplySuggestions}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md shadow-violet-500/20"
            size="sm"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Ajouter ces {suggestions.length} pièces
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

