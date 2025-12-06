"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, Home, Bed, Bath, ChefHat, Sofa, Briefcase, AlertCircle } from "lucide-react";
import type { RoomTypeV3, PropertyTypeV3 } from "@/lib/types/property-v3";

interface RoomSuggestion {
  type_piece: RoomTypeV3;
  label: string;
  icon: React.ElementType;
}

/**
 * Génère des suggestions de pièces INTELLIGENTES basées sur :
 * 1. Le type de bien
 * 2. Le nombre de pièces réel (nb_pieces) si disponible
 * 
 * Logique : nb_pieces = Séjour + Chambres (convention française)
 * Exemple : T3 = 3 pièces = 1 Séjour + 2 Chambres
 */
function generateSmartSuggestions(
  propertyType: string,
  nbPieces: number | undefined | null
): RoomSuggestion[] {
  const suggestions: RoomSuggestion[] = [];
  
  // Nombre de pièces réel ou estimation par défaut selon le type
  const defaultNbPieces: Record<string, number> = {
    studio: 1,
    appartement: 2,
    maison: 3,
    colocation: 4,
    saisonnier: 2,
  };
  
  const effectiveNbPieces = nbPieces && nbPieces > 0 
    ? nbPieces 
    : defaultNbPieces[propertyType] || 2;

  switch (propertyType) {
    case "studio":
      // Studio = 1 pièce principale uniquement
      suggestions.push({ type_piece: "salon_cuisine", label: "Pièce principale", icon: Sofa });
      suggestions.push({ type_piece: "salle_eau", label: "Salle d'eau", icon: Bath });
      break;

    case "appartement":
    case "maison":
      // Séjour (compte comme 1 pièce)
      suggestions.push({ type_piece: "sejour", label: "Séjour", icon: Sofa });
      suggestions.push({ type_piece: "cuisine", label: "Cuisine", icon: ChefHat });
      
      // Chambres = nb_pieces - 1 (le séjour compte comme 1 pièce)
      const nbChambres = Math.max(1, effectiveNbPieces - 1);
      for (let i = 1; i <= nbChambres; i++) {
        suggestions.push({ 
          type_piece: "chambre", 
          label: nbChambres === 1 ? "Chambre" : `Chambre ${i}`, 
          icon: Bed 
        });
      }
      
      // SDB et WC
      suggestions.push({ type_piece: "salle_de_bain", label: "Salle de bain", icon: Bath });
      if (propertyType === "maison" || effectiveNbPieces >= 4) {
        suggestions.push({ type_piece: "wc", label: "WC", icon: Bath });
      }
      break;

    case "colocation":
      // En colocation, chaque pièce = 1 chambre privative
      const nbChambresColoc = effectiveNbPieces;
      for (let i = 1; i <= nbChambresColoc; i++) {
        suggestions.push({ type_piece: "chambre", label: `Chambre ${i}`, icon: Bed });
      }
      // Espaces communs
      suggestions.push({ type_piece: "salon_cuisine", label: "Cuisine/Salon commun", icon: Sofa });
      // 1 SDB pour 2 chambres (arrondi au supérieur)
      const nbSDB = Math.ceil(nbChambresColoc / 2);
      for (let i = 1; i <= nbSDB; i++) {
        suggestions.push({ 
          type_piece: "salle_de_bain", 
          label: nbSDB === 1 ? "Salle de bain" : `SDB ${i}`, 
          icon: Bath 
        });
      }
      suggestions.push({ type_piece: "wc", label: "WC", icon: Bath });
      break;

    case "saisonnier":
      suggestions.push({ type_piece: "salon_cuisine", label: "Salon/Cuisine", icon: Sofa });
      const nbChambresSaison = Math.max(1, effectiveNbPieces - 1);
      for (let i = 1; i <= nbChambresSaison; i++) {
        suggestions.push({ 
          type_piece: "chambre", 
          label: nbChambresSaison === 1 ? "Chambre" : `Chambre ${i}`, 
          icon: Bed 
        });
      }
      suggestions.push({ type_piece: "salle_de_bain", label: "Salle de bain", icon: Bath });
      suggestions.push({ type_piece: "terrasse", label: "Terrasse/Balcon", icon: Sofa });
      break;

    case "local_commercial":
      suggestions.push({ type_piece: "sejour", label: "Espace principal", icon: Home });
      suggestions.push({ type_piece: "stockage", label: "Réserve", icon: Home });
      suggestions.push({ type_piece: "wc", label: "WC", icon: Bath });
      break;

    case "bureaux":
      // Bureaux : nb_pieces = nombre de bureaux
      const nbBureaux = effectiveNbPieces;
      for (let i = 1; i <= nbBureaux; i++) {
        suggestions.push({ 
          type_piece: "bureau", 
          label: nbBureaux === 1 ? "Bureau" : `Bureau ${i}`, 
          icon: Briefcase 
        });
      }
      suggestions.push({ type_piece: "cuisine", label: "Kitchenette", icon: ChefHat });
      suggestions.push({ type_piece: "wc", label: "WC", icon: Bath });
      break;

    default:
      // Fallback générique
      suggestions.push({ type_piece: "sejour", label: "Pièce principale", icon: Sofa });
      suggestions.push({ type_piece: "salle_de_bain", label: "Salle de bain", icon: Bath });
  }

  return suggestions;
}

interface SmartRoomSuggestionsProps {
  onApply?: () => void;
}

export function SmartRoomSuggestions({ onApply }: SmartRoomSuggestionsProps) {
  const { formData, rooms, addRoom } = usePropertyWizardStore();

  const propertyType = formData.type as PropertyTypeV3 | undefined;
  const nbPieces = formData.nb_pieces as number | undefined;
  
  // ✅ Suggestions INTELLIGENTES basées sur nb_pieces réel
  const suggestions = useMemo(() => {
    if (!propertyType) return null;
    return generateSmartSuggestions(propertyType, nbPieces);
  }, [propertyType, nbPieces]);
  
  // Indicateur si on utilise une estimation par défaut
  const isUsingDefault = !nbPieces || nbPieces <= 0;

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
          <p className="text-xs text-violet-700 dark:text-violet-300 mb-2">
            {nbPieces && nbPieces > 0 ? (
              <>Suggestion basée sur <strong>{nbPieces} pièces</strong> pour ce {typeLabel} :</>
            ) : (
              <>Suggestion typique pour un {typeLabel} :</>
            )}
          </p>

          {/* Avertissement si estimation par défaut */}
          {isUsingDefault && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded mb-2">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span>Nombre de pièces non renseigné - suggestion par défaut</span>
            </div>
          )}

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

