"use client";

import React from "react";
import { motion } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { HAB_EQUIPMENTS } from "@/lib/types/property-v3";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Wifi, Tv, ChefHat, Waves, Wind, Bike, 
  Dog, Baby, Coffee, UtensilsCrossed, 
  Trash2, ShieldCheck, Dumbbell, Car,
  TreePine, Palmtree, Umbrella
} from "lucide-react";
import { cn } from "@/lib/utils";

const EQUIPMENT_ICONS: Record<string, React.ElementType> = {
  wifi: Wifi,
  television: Tv,
  cuisine_equipee: ChefHat,
  lave_linge: Waves,
  lave_vaisselle: UtensilsCrossed,
  micro_ondes: UtensilsCrossed,
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
  climatisation: Wind,
};

// Fallback icon if not found
import { Home } from "lucide-react";

export function FeaturesStep() {
  const { formData, updateFormData } = usePropertyWizardStore();
  const selectedEquipments = formData.equipments || [];

  const toggleEquipment = (equipment: string) => {
    const newEquipments = selectedEquipments.includes(equipment as any)
      ? selectedEquipments.filter((e) => e !== equipment)
      : [...selectedEquipments, equipment as any];
    
    updateFormData({ equipments: newEquipments });
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto overflow-y-auto pb-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-1">
        {HAB_EQUIPMENTS.map((equipment, index) => {
          const Icon = EQUIPMENT_ICONS[equipment] || Home;
          const isSelected = selectedEquipments.includes(equipment);
          const label = equipment
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());

          return (
            <motion.div
              key={equipment}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <label
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer h-full text-center gap-3",
                  isSelected
                    ? "bg-primary/5 border-primary shadow-sm"
                    : "bg-card border-muted hover:border-muted-foreground/30"
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                
                <div className="space-y-1">
                  <p className={cn(
                    "text-xs font-semibold leading-tight",
                    isSelected ? "text-primary" : "text-card-foreground"
                  )}>
                    {label}
                  </p>
                </div>

                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleEquipment(equipment)}
                  className="mt-auto"
                />
              </label>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

