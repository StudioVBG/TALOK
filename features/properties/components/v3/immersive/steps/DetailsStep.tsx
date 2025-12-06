"use client";

/**
 * DetailsStep - Composant routeur intelligent
 * 
 * Affiche automatiquement le bon formulaire selon le type de bien :
 * - Habitation (appartement, maison, studio, colocation, saisonnier) → DetailsStepHabitation
 * - Parking (parking, box) → DetailsStepParking
 * - Professionnel (local_commercial, bureaux, entrepot, fonds_de_commerce) → DetailsStepPro
 */

import React from "react";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { DetailsStepHabitation } from "./DetailsStepHabitation";
import { DetailsStepParking } from "./DetailsStepParking";
import { DetailsStepPro } from "./DetailsStepPro";

// Catégories de types de biens
const HABITATION_TYPES = ["appartement", "maison", "studio", "colocation", "saisonnier"];
const PARKING_TYPES = ["parking", "box"];
const PRO_TYPES = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"];

export function DetailsStep() {
  const { formData } = usePropertyWizardStore();
  const propertyType = (formData.type as string) || "";

  // Router vers le bon composant selon le type
  if (HABITATION_TYPES.includes(propertyType)) {
    return <DetailsStepHabitation />;
  }

  if (PARKING_TYPES.includes(propertyType)) {
    return <DetailsStepParking />;
  }

  if (PRO_TYPES.includes(propertyType)) {
    return <DetailsStepPro />;
  }

  // Fallback : afficher le formulaire habitation par défaut
  return <DetailsStepHabitation />;
}
