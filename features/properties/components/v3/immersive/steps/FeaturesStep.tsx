"use client";

import React, { useId, useState } from "react";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { HAB_EQUIPMENTS } from "@/lib/types/property-v3";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Wifi, Tv, ChefHat, Waves, Wind, Bike,
  Dog, Baby, Coffee, UtensilsCrossed,
  ShieldCheck, Dumbbell, Car, ChevronDown,
  TreePine, Palmtree, Home, Snowflake,
  WashingMachine, Microwave
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const ESSENTIAL_EQUIPMENT = new Set([
  "wifi", "cuisine_equipee", "lave_linge", "lave_vaisselle",
  "balcon", "terrasse", "jardin", "parking_residence",
]);

const CATEGORIES = [
  {
    id: "essential",
    title: "Les plus courants",
    filter: (e: string) => ESSENTIAL_EQUIPMENT.has(e),
    defaultOpen: true,
  },
  {
    id: "comfort",
    title: "Confort & électroménager",
    filter: (e: string) =>
      ["television", "micro_ondes", "machine_a_cafe", "fer_repasser", "seche_cheveux"].includes(e),
    defaultOpen: false,
  },
  {
    id: "extras",
    title: "Loisirs & services",
    filter: (e: string) =>
      ["piscine", "salle_sport", "local_velo", "animaux_acceptes", "equipement_bebe"].includes(e),
    defaultOpen: false,
  },
];

function EquipmentCard({
  equipment,
  isSelected,
  label,
  checkboxId,
  onToggle,
}: {
  equipment: string;
  isSelected: boolean;
  label: string;
  checkboxId: string;
  onToggle: () => void;
}) {
  const Icon = EQUIPMENT_ICONS[equipment] || Home;
  return (
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
      <Checkbox
        id={checkboxId}
        checked={isSelected}
        onCheckedChange={onToggle}
        className="mt-auto"
        aria-label={`${label} - ${isSelected ? 'sélectionné' : 'non sélectionné'}`}
      />
    </label>
  );
}

export function FeaturesStep() {
  const { formData, updateFormData } = usePropertyWizardStore();
  const selectedEquipments = formData.equipments || [];
  const baseId = useId();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(CATEGORIES.map((c) => [c.id, c.defaultOpen]))
  );

  const allEquipments = HAB_EQUIPMENTS.filter((e) => e !== "climatisation");

  const toggleEquipment = (equipment: string) => {
    const newEquipments = selectedEquipments.includes(equipment)
      ? selectedEquipments.filter((e) => e !== equipment)
      : [...selectedEquipments, equipment];
    updateFormData({ equipments: newEquipments });
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className="h-full flex flex-col max-w-4xl mx-auto overflow-y-auto pb-8"
      role="group"
      aria-label="Sélection des équipements du bien"
    >
      <div className="flex-shrink-0 mb-4 px-1">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {selectedEquipments.length === 0
            ? "Aucun équipement sélectionné"
            : `${selectedEquipments.length} équipement${selectedEquipments.length > 1 ? 's' : ''} sélectionné${selectedEquipments.length > 1 ? 's' : ''}`
          }
        </p>
      </div>

      <div className="space-y-6 p-1">
        {CATEGORIES.map((category) => {
          const items = allEquipments.filter(category.filter);
          if (items.length === 0) return null;
          const isOpen = openSections[category.id];
          const selectedInCategory = items.filter((e) => selectedEquipments.includes(e)).length;

          return (
            <div key={category.id}>
              <button
                type="button"
                onClick={() => toggleSection(category.id)}
                className="flex items-center gap-2 w-full text-left mb-3"
              >
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                <span className="text-sm font-semibold text-foreground">{category.title}</span>
                {selectedInCategory > 0 && (
                  <span className="text-xs text-primary font-medium ml-auto">
                    {selectedInCategory} sélectionné{selectedInCategory > 1 ? 's' : ''}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                  {items.map((equipment) => {
                    const isSelected = selectedEquipments.includes(equipment);
                    const label = EQUIPMENT_LABELS[equipment] || equipment.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                    const checkboxId = `${baseId}-${equipment}`;
                    return (
                      <EquipmentCard
                        key={equipment}
                        equipment={equipment}
                        isSelected={isSelected}
                        label={label}
                        checkboxId={checkboxId}
                        onToggle={() => toggleEquipment(equipment)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

