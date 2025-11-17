/**
 * EquipmentsInfoStep - Composant adaptatif pour équipements & informations V3
 * 
 * Sources :
 * - Modèle V3 section 2.4 : Étape 3 - Équipements & commodités + infos essentielles
 * - Design SOTA 2025 : Bento Grid pour équipements, composant adaptatif selon type_bien
 * - Types V3 : lib/types/property-v3.ts (HAB_EQUIPMENTS, EquipmentV3)
 * 
 * Ce composant affiche différents blocs selon le type de bien :
 * - Habitation : infos essentielles, chauffage/confort, équipements (Bento Grid)
 * - Parking/Box : infos parking, sécurité & accès
 * - Locaux pro : infos essentielles, équipements pro
 */

"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { StepHeader, UnifiedInput, UnifiedCheckbox, UnifiedSectionCard, UnifiedFormContainer } from "@/lib/design-system/wizard-components";
import { containerVariants } from "@/lib/design-system/animations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Home,
  Car,
  Building2,
  Flame,
  Snowflake,
  Wifi,
  Tv,
  ChefHat,
  Shield,
  Zap,
  Waves,
  Droplet,
  Coffee,
  Wind,
  Dumbbell,
  Bike,
  ParkingCircle,
  PawPrint,
  Heart,
  Sprout,
} from "lucide-react";
import type { PropertyTypeV3, EquipmentV3 } from "@/lib/types/property-v3";
import { HAB_EQUIPMENTS } from "@/lib/types/property-v3";

interface EquipmentsInfoStepProps {
  type_bien: PropertyTypeV3;
  // Habitation
  surface_habitable_m2?: number;
  nb_pieces?: number;
  nb_chambres?: number;
  etage?: number | null;
  ascenseur?: boolean;
  meuble?: boolean;
  has_balcon?: boolean;
  has_terrasse?: boolean;
  has_jardin?: boolean;
  has_cave?: boolean;
  chauffage_type?: "individuel" | "collectif" | "aucun";
  chauffage_energie?: string;
  eau_chaude_type?: string;
  clim_presence?: "aucune" | "mobile" | "fixe";
  clim_type?: "split" | "gainable";
  equipments?: EquipmentV3[];
  // Parking
  parking_type?: string;
  parking_numero?: string;
  parking_niveau?: string;
  parking_gabarit?: string;
  parking_acces?: string[];
  parking_portail_securise?: boolean;
  parking_video_surveillance?: boolean;
  parking_gardien?: boolean;
  // Local pro
  local_surface_totale?: number;
  local_type?: string;
  local_has_vitrine?: boolean;
  local_access_pmr?: boolean;
  local_clim?: boolean;
  local_fibre?: boolean;
  local_alarme?: boolean;
  local_rideau_metal?: boolean;
  local_acces_camion?: boolean;
  local_parking_clients?: boolean;
  onChange: (data: any) => void;
  errors?: any;
}

// Icônes pour équipements
const EQUIPMENT_ICONS: Record<EquipmentV3, typeof Wifi> = {
  wifi: Wifi,
  television: Tv,
  cuisine_equipee: ChefHat,
  lave_linge: Waves, // Machine à laver
  lave_vaisselle: Droplet, // Lave-vaisselle
  micro_ondes: Zap, // Micro-ondes (électricité)
  machine_a_cafe: Coffee, // Machine à café
  fer_repasser: Zap, // Fer à repasser (électricité)
  seche_cheveux: Wind, // Sèche-cheveux (vent)
  balcon: Home,
  terrasse: Home,
  jardin: Sprout, // Jardin (plante)
  piscine: Waves, // Piscine (eau)
  salle_sport: Dumbbell, // Salle de sport
  local_velo: Bike, // Local vélo
  parking_residence: ParkingCircle, // Parking résidence
  animaux_acceptes: PawPrint, // Animaux acceptés
  equipement_bebe: Heart, // Équipement bébé
  climatisation: Snowflake,
};

// Composant de carte équipement (Bento Grid style)
function EquipmentCard({
  equipment,
  isSelected,
  onToggle,
}: {
  equipment: EquipmentV3;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const Icon = EQUIPMENT_ICONS[equipment] || Wifi;
  const label = equipment
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
        isSelected
          ? "border-primary bg-primary/10 shadow-lg"
          : "border-border/50 bg-background/80 backdrop-blur-sm hover:border-primary/50 hover:bg-primary/5"
      }`}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <Icon className={`h-7 w-7 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-base font-semibold text-foreground">{label}</span>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="h-2 w-2 rounded-full bg-primary"
          />
        )}
      </div>
    </motion.div>
  );
}

export function EquipmentsInfoStep({
  type_bien,
  onChange,
  errors,
  ...props
}: EquipmentsInfoStepProps) {
  const [equipments, setEquipments] = useState<EquipmentV3[]>(props.equipments || []);

  const isHabitation = ["appartement", "maison", "studio", "colocation"].includes(type_bien);
  const isParking = ["parking", "box"].includes(type_bien);
  const isLocalPro = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(type_bien);

  const toggleEquipment = (equipment: EquipmentV3) => {
    const newEquipments = equipments.includes(equipment)
      ? equipments.filter((e) => e !== equipment)
      : [...equipments, equipment];
    setEquipments(newEquipments);
    onChange({ equipments: newEquipments });
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      {/* Titre */}
      <StepHeader
        title="Équipements & informations"
        description="Décrivez les caractéristiques du bien"
        icon={<Home className="h-6 w-6 text-primary" />}
      />

      {/* Contenu adaptatif selon le type */}
      <AnimatePresence mode="wait">
        {isHabitation && (
          <motion.div
            key="habitation"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Bloc A - Infos essentielles */}
            <UnifiedSectionCard
              title="Informations essentielles"
              icon={<Home className="h-6 w-6 text-primary" />}
            >
              <div className="grid gap-6 md:grid-cols-3">
                <UnifiedInput
                  id="surface_habitable_m2"
                  label="Surface habitable (m²)"
                  value={props.surface_habitable_m2}
                  onChange={(value) => onChange({ surface_habitable_m2: Number(value) })}
                  type="number"
                  placeholder="65"
                  required
                />
                <UnifiedInput
                  id="nb_pieces"
                  label="Nombre de pièces"
                  value={props.nb_pieces}
                  onChange={(value) => onChange({ nb_pieces: Number(value) })}
                  type="number"
                  placeholder="3"
                  required
                />
                <UnifiedInput
                  id="nb_chambres"
                  label="Nombre de chambres"
                  value={props.nb_chambres}
                  onChange={(value) => onChange({ nb_chambres: Number(value) })}
                  type="number"
                  placeholder="2"
                  required
                />
              </div>

              {/* Extérieurs (checkboxes) */}
              {(type_bien === "appartement" || type_bien === "studio") && (
                <div className="flex gap-6">
                  <UnifiedCheckbox
                    id="has_balcon"
                    label="Balcon"
                    checked={props.has_balcon || false}
                    onCheckedChange={(checked) => onChange({ has_balcon: checked })}
                  />
                  <UnifiedCheckbox
                    id="has_terrasse"
                    label="Terrasse"
                    checked={props.has_terrasse || false}
                    onCheckedChange={(checked) => onChange({ has_terrasse: checked })}
                  />
                  <UnifiedCheckbox
                    id="has_cave"
                    label="Cave"
                    checked={props.has_cave || false}
                    onCheckedChange={(checked) => onChange({ has_cave: checked })}
                  />
                </div>
              )}
            </UnifiedSectionCard>

            {/* Bloc B - Chauffage & confort */}
            <UnifiedSectionCard
              title="Chauffage & confort"
              icon={<Flame className="h-6 w-6 text-primary" />}
            >
              <div className="text-sm text-muted-foreground">
                Les champs de chauffage et confort seront implémentés prochainement.
              </div>
            </UnifiedSectionCard>

            {/* Bloc C - Équipements (Bento Grid) */}
            <UnifiedSectionCard
              title="Équipements"
              icon={<Zap className="h-6 w-6 text-primary" />}
            >
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {HAB_EQUIPMENTS.map((equipment) => (
                    <EquipmentCard
                      key={equipment}
                      equipment={equipment}
                      isSelected={equipments.includes(equipment)}
                      onToggle={() => toggleEquipment(equipment)}
                    />
                  ))}
                </div>
            </UnifiedSectionCard>
          </motion.div>
        )}

        {isParking && (
          <motion.div
            key="parking"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <UnifiedSectionCard
              title="Informations du parking"
              icon={<Car className="h-6 w-6 text-primary" />}
            >
              <div className="text-sm text-muted-foreground">
                Les champs spécifiques au parking seront implémentés prochainement.
              </div>
            </UnifiedSectionCard>
          </motion.div>
        )}

        {isLocalPro && (
          <motion.div
            key="local-pro"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <UnifiedSectionCard
              title="Informations du local"
              icon={<Building2 className="h-6 w-6 text-primary" />}
            >
              <div className="text-sm text-muted-foreground">
                Les champs spécifiques aux locaux professionnels seront implémentés prochainement.
              </div>
            </UnifiedSectionCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

