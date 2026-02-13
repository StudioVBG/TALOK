"use client";

/**
 * DetailsStep - Composant routeur intelligent
 *
 * Affiche automatiquement le bon formulaire selon le type de bien :
 * - Habitation → DetailsStepHabitation
 * - Parking/Cave → DetailsStepParking
 * - Professionnel → DetailsStepPro
 * - Terrain → DetailsStepTerrain
 */

import React from "react";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { DetailsStepHabitation } from "./DetailsStepHabitation";
import { DetailsStepParking } from "./DetailsStepParking";
import { DetailsStepPro } from "./DetailsStepPro";
import { DetailsStepTerrain } from "./DetailsStepTerrain";

// Catégories de types de biens
const HABITATION_TYPES = [
  "appartement", "maison", "studio", "villa", "chambre",
  "colocation", "saisonnier", "case_creole", "bungalow", "logement_social",
];
const PARKING_TYPES = ["parking", "box", "cave_cellier"];
const PRO_TYPES = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"];
const TERRAIN_TYPES = ["terrain_nu", "terrain_agricole", "exploitation_agricole"];

export function DetailsStep() {
  const { formData } = usePropertyWizardStore();
  const propertyType = (formData.type as string) || "";

  if (HABITATION_TYPES.includes(propertyType)) {
    return <DetailsStepHabitation />;
  }

  if (PARKING_TYPES.includes(propertyType)) {
    return <DetailsStepParking />;
  }

  if (PRO_TYPES.includes(propertyType)) {
    return <DetailsStepPro />;
  }

  if (TERRAIN_TYPES.includes(propertyType)) {
    return <DetailsStepTerrain />;
  }

  // Fallback
  return <DetailsStepHabitation />;
}
