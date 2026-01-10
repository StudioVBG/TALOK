"use client";

import React, { useId } from "react";
import { motion } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { HAB_EQUIPMENTS } from "@/lib/types/property-v3";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Wifi, Tv, ChefHat, Waves, Wind, Bike,
  Dog, Baby, Coffee, UtensilsCrossed,
  ShieldCheck, Dumbbell, Car,
  TreePine, Palmtree, Home, Snowflake,
  WashingMachine, Microwave, IronIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

// SOTA 2026: Mapping complet des équipements vers icônes
const EQUIPMENT_ICONS: Record<string, React.ElementType> = {
  wifi: Wifi,
  television: Tv,
  cuisine_equipee: ChefHat,
  lave_linge: WashingMachine,
  lave_vaisselle: UtensilsCrossed,
  micro_ondes: Microwave,
  machine_a_cafe: Coffee,
  fer_repasser: ShieldCheck,
  seche_cheveux: Wind,
  balcon: Home,
  terrasse: Palmtree,
  jardin: TreePine,
  piscine: Waves,
  salle_sport: Dumbbell,
  local_velo: Bike,
  parking_residence: Car,
  animaux_acceptes: Dog,
  equipement_bebe: Baby,
  climatisation: Snowflake,
};

// SOTA 2026: Labels lisibles pour les équipements
const EQUIPMENT_LABELS: Record<string, string> = {
  wifi: "WiFi",
  television: "Télévision",
  cuisine_equipee: "Cuisine équipée",
  lave_linge: "Lave-linge",
  lave_vaisselle: "Lave-vaisselle",
  micro_ondes: "Micro-ondes",
  machine_a_cafe: "Machine à café",
  fer_repasser: "Fer à repasser",
  seche_cheveux: "Sèche-cheveux",
  balcon: "Balcon",
  terrasse: "Terrasse",
  jardin: "Jardin",
  piscine: "Piscine",
  salle_sport: "Salle de sport",
  local_velo: "Local vélo",
  parking_residence: "Parking résidence",
  animaux_acceptes: "Animaux acceptés",
  equipement_bebe: "Équipement bébé",
  climatisation: "Climatisation",
};

export function FeaturesStep() {
  const { formData, updateFormData } = usePropertyWizardStore();
  const selectedEquipments = formData.equipments || [];
  const baseId = useId();

  const toggleEquipment = (equipment: string) => {
    const newEquipments = selectedEquipments.includes(equipment)
      ? selectedEquipments.filter((e) => e !== equipment)
      : [...selectedEquipments, equipment];

    updateFormData({ equipments: newEquipments });
  };

  return (
    <div
      className="h-full flex flex-col max-w-4xl mx-auto overflow-y-auto pb-8"
      role="group"
      aria-label="Sélection des équipements du bien"
    >
      {/* SOTA 2026: Compteur d'équipements sélectionnés */}
      <div className="flex-shrink-0 mb-4 px-1">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {selectedEquipments.length === 0
            ? "Aucun équipement sélectionné"
            : `${selectedEquipments.length} équipement${selectedEquipments.length > 1 ? 's' : ''} sélectionné${selectedEquipments.length > 1 ? 's' : ''}`
          }
        </p>
      </div>

      {/* SOTA 2026: Grille responsive améliorée avec accessibilité */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 p-1">
        {HAB_EQUIPMENTS.map((equipment, index) => {
          const Icon = EQUIPMENT_ICONS[equipment] || Home;
          const isSelected = selectedEquipments.includes(equipment);
          const label = EQUIPMENT_LABELS[equipment] || equipment.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
          const checkboxId = `${baseId}-${equipment}`;

          return (
            <motion.div
              key={equipment}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              {/* SOTA 2026: Label avec htmlFor pour accessibilité */}
              <label
                htmlFor={checkboxId}
                className={cn(
                  "flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border-2 transition-all cursor-pointer h-full text-center gap-2 md:gap-3",
                  "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
                  "min-h-[100px] md:min-h-[120px]",
                  isSelected
                    ? "bg-primary/5 border-primary shadow-sm"
                    : "bg-card border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                )}
              >
                <div className={cn(
                  "h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center transition-colors",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
                </div>

                <span className={cn(
                  "text-xs md:text-sm font-medium leading-tight",
                  isSelected ? "text-primary" : "text-card-foreground"
                )}>
                  {label}
                </span>

                {/* SOTA 2026: Checkbox avec id pour accessibilité */}
                <Checkbox
                  id={checkboxId}
                  checked={isSelected}
                  onCheckedChange={() => toggleEquipment(equipment)}
                  className="mt-auto"
                  aria-label={`${label} - ${isSelected ? 'sélectionné' : 'non sélectionné'}`}
                />
              </label>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

