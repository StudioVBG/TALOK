/**
 * Constants for Create Inspection Wizard
 * Extracted from CreateInspectionWizard.tsx
 */

import {
  DoorOpen,
  Sofa,
  UtensilsCrossed,
  Bath,
  Bed,
  Car,
  Warehouse,
  TreePine,
} from "lucide-react";
import type { RoomTemplate, WizardStep, ConditionOption, MeterType } from "./types";

// Base items present in most rooms
export const BASE_ITEMS = [
  "Sol",
  "Murs",
  "Plafond",
  "Fenêtre(s)",
  "Porte",
  "Éclairage",
  "Prises électriques",
  "Radiateur/Chauffage",
];

// Room templates with their default items
export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "entree",
    name: "Entrée",
    icon: DoorOpen,
    items: ["Porte d'entrée", "Serrure", "Sonnette/Interphone", ...BASE_ITEMS, "Placard", "Autre"],
  },
  {
    id: "salon",
    name: "Salon / Séjour",
    icon: Sofa,
    items: [...BASE_ITEMS, "Volets/Stores", "Placard", "Autre"],
  },
  {
    id: "cuisine",
    name: "Cuisine",
    icon: UtensilsCrossed,
    items: [
      ...BASE_ITEMS,
      "Évier",
      "Robinetterie",
      "Plan de travail",
      "Plaques de cuisson",
      "Four",
      "Hotte",
      "Réfrigérateur",
      "Placards",
      "Autre",
    ],
  },
  {
    id: "chambre",
    name: "Chambre",
    icon: Bed,
    items: [...BASE_ITEMS, "Volets/Stores", "Placard", "Autre"],
  },
  {
    id: "sdb",
    name: "Salle de bain",
    icon: Bath,
    items: [
      ...BASE_ITEMS,
      "Baignoire/Douche",
      "Lavabo",
      "Robinetterie",
      "Miroir",
      "Ventilation",
      "WC",
      "Autre",
    ],
  },
  {
    id: "wc",
    name: "WC",
    icon: Bath,
    items: [
      "Sol",
      "Murs",
      "Plafond",
      "Porte",
      "Cuvette",
      "Chasse d'eau",
      "Lave-mains",
      "Ventilation",
      "Éclairage",
      "Autre",
    ],
  },
  {
    id: "garage",
    name: "Garage / Parking",
    icon: Car,
    items: ["Porte/Accès", ...BASE_ITEMS, "Éclairage", "Autre"],
  },
  {
    id: "cave",
    name: "Cave / Cellier",
    icon: Warehouse,
    items: ["Porte/Accès", ...BASE_ITEMS, "Autre"],
  },
  {
    id: "exterieur",
    name: "Extérieur / Jardin",
    icon: TreePine,
    items: ["Portail/Clôture", "Allées", "Pelouse", "Terrasse", "Éclairage extérieur", "Autre"],
  },
];

// Condition options for items
export const CONDITION_OPTIONS: ConditionOption[] = [
  { value: "neuf", label: "Neuf", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "bon", label: "Bon état", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "moyen", label: "État moyen", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "mauvais", label: "Mauvais état", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "tres_mauvais", label: "Très mauvais", color: "bg-red-100 text-red-800 border-red-300" },
];

// Wizard steps
export const STEPS: WizardStep[] = [
  { id: "lease", title: "Bail", description: "Sélectionnez le bail concerné" },
  { id: "type", title: "Type", description: "Entrée ou sortie" },
  { id: "meters", title: "Compteurs", description: "Relevés des compteurs" },
  { id: "rooms", title: "Pièces", description: "Sélectionnez les pièces" },
  { id: "inspection", title: "Inspection", description: "Remplissez l'EDL" },
  { id: "keys", title: "Clés", description: "Trousseau de clés" },
  { id: "summary", title: "Résumé", description: "Vérifiez et validez" },
];

// Meter types
export const METER_TYPES: MeterType[] = [
  { type: "electricity", label: "Électricité", unit: "kWh", icon: "⚡" },
  { type: "gas", label: "Gaz", unit: "m³", icon: "🔥" },
  { type: "water", label: "Eau froide", unit: "m³", icon: "💧" },
  { type: "water_hot", label: "Eau chaude", unit: "m³", icon: "🚿" },
];

// Default key types
export const DEFAULT_KEY_TYPES = [
  "Clé Porte d'entrée",
  "Badge Immeuble",
  "Digicode / Code d'accès",
  "Clé Boîte aux lettres",
  "Clé Garage / Parking",
  "Clé Cave",
  "Télécommande Portail",
];

// Default meter readings (initial state)
export const DEFAULT_METER_READINGS = [
  { type: "electricity" as const, meterNumber: "", reading: "", unit: "kWh" },
  { type: "water" as const, meterNumber: "", reading: "", unit: "m³" },
];

// Default keys (initial state)
export const DEFAULT_KEYS = [
  { type: "Clé Porte d'entrée", count: 1, notes: "" },
];
