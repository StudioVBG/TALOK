/**
 * Configuration Wizard Property V3
 * 
 * Sources :
 * - Modèle détaillé fourni par l'utilisateur (section 2 : Wizard UX - étapes détaillées)
 * - Configuration existante : config/propertyWizard.ts
 * - Types V3 : lib/types/property-v3.ts
 * 
 * Cette configuration définit les étapes du wizard et les champs par type de bien
 */

"use client";

import type { PropertyTypeV3, EquipmentV3 } from "@/lib/types/property-v3";
import { PROPERTY_TYPE_GROUPS, HAB_EQUIPMENTS } from "@/lib/types/property-v3";

// ============================================
// 1. TYPES & INTERFACES
// ============================================
// Source : Structure basée sur config/propertyWizard.ts mais adaptée au modèle V3

export type FieldType = "text" | "number" | "select" | "radio" | "checkbox" | "textarea" | "array";

export interface VisibleWhen {
  field: string;
  equals?: any;
  in?: any[];
  notEquals?: any;
}

export interface FieldConfig {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpKey?: string;
  options?: { value: any; label: string; icon?: string }[];
  step: number;
  visibleWhen?: VisibleWhen | VisibleWhen[];
  defaultValue?: any;
  min?: number;
  max?: number;
}

export interface StepConfig {
  id: string;
  title: string;
  description?: string;
  helpKey?: string;
  component?: string; // Composant React personnalisé (optionnel)
  infoCards?: {
    title: string;
    description?: string;
    icon?: string;
  }[];
  nextLabel?: string;
  previousLabel?: string;
  skipCondition?: (data: any) => boolean; // Condition pour sauter cette étape
}

export interface WizardConfigV3 {
  steps: StepConfig[];
  fieldsByType: Record<PropertyTypeV3, FieldConfig[]>;
}

// ============================================
// 2. CHAMPS COMMUNS (tous types de biens)
// ============================================
// Source modèle V3 section 2.3 : Étape 2 - Adresse
// Source existante : config/propertyWizard.ts ligne 49-54

const commonAddressFields: FieldConfig[] = [
  {
    id: "adresse_complete",
    label: "Adresse complète",
    type: "text",
    required: true,
    placeholder: "Ex: 12 Rue du Parc",
    step: 2,
    helpKey: "adresse_complete",
  },
  {
    id: "complement_adresse",
    label: "Complément d'adresse",
    type: "text",
    placeholder: "Ex: Bâtiment B, 3e étage",
    step: 2,
    helpKey: "complement_adresse",
  },
  {
    id: "code_postal",
    label: "Code postal",
    type: "text",
    required: true,
    placeholder: "97200",
    step: 2,
    helpKey: "code_postal",
  },
  {
    id: "ville",
    label: "Ville",
    type: "text",
    required: true,
    placeholder: "Fort-de-France",
    step: 2,
    helpKey: "ville",
  },
];

// ============================================
// 3. CONFIGURATION DES ÉTAPES
// ============================================
// Source modèle V3 section 2 : Wizard UX - étapes détaillées
// Source existante : config/propertyWizard.ts ligne 74-141

export const WIZARD_STEPS_V3: StepConfig[] = [
  {
    id: "type-usage",
    title: "Type & usage",
    description: "Quel type de bien souhaitez-vous ajouter ?",
    component: "PropertyTypeSelection", // Composant personnalisé avec 3 blocs visuels
    helpKey: "type_choix",
    infoCards: [
      {
        title: "Conforme à la réglementation",
        description: "Chaque type de bien applique ses propres règles juridiques.",
        icon: "shield-check",
      },
    ],
    nextLabel: "Continuer",
  },
  {
    id: "adresse",
    title: "Adresse",
    description: "Localisez précisément le bien pour accélérer les diagnostics.",
    component: "AddressStep",
    helpKey: "adresse_completion",
  },
  {
    id: "equipments-info",
    title: "Équipements & informations",
    description: "Décrivez les caractéristiques du bien",
    component: "EquipmentsInfoStep", // Composant adaptatif selon type_bien
    helpKey: "equipments_info",
    infoCards: [
      {
        title: "Conseil pro",
        description: "Des informations précises facilitent la mise en location.",
        icon: "info",
      },
    ],
  },
  {
    id: "pieces-photos",
    title: "Pièces & photos",
    description: "Ajoutez les pièces et photos",
    component: "RoomsPhotosStep", // Ou PhotosStep si parking/local
    helpKey: "pieces_medias",
    skipCondition: (data) => {
      // Skip si parking/box/local (pas de pièces nécessaires)
      return ["parking", "box", "local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(
        data.type_bien
      );
    },
  },
  {
    id: "conditions",
    title: "Conditions de location",
    description: "Définissez les conditions financières",
    component: "ConditionsStep",
    helpKey: "conditions_location",
  },
  {
    id: "recap",
    title: "Récapitulatif",
    description: "Vérifiez et soumettez",
    component: "RecapStep",
    helpKey: "recapitulatif_final",
    nextLabel: "Soumettre pour validation",
    previousLabel: "Retour",
  },
];

// ============================================
// 4. CONFIGURATION DES CHAMPS PAR TYPE
// ============================================
// Source modèle V3 section 2.4 : Étape 3 - Équipements & commodités + infos essentielles

// 4.1. HABITATION (appartement, maison, studio, colocation)
// Source modèle V3 section 2.4.1

const habitationBaseFields: FieldConfig[] = [
  ...commonAddressFields,
  {
    id: "surface_habitable_m2",
    label: "Surface habitable (m²)",
    type: "number",
    required: true,
    step: 3,
    min: 1,
    helpKey: "surface_habitable",
  },
  {
    id: "nb_pieces",
    label: "Nombre de pièces",
    type: "number",
    required: true,
    step: 3,
    min: 1,
    helpKey: "nb_pieces",
  },
  {
    id: "nb_chambres",
    label: "Nombre de chambres",
    type: "number",
    required: true,
    step: 3,
    min: 0,
    helpKey: "nb_chambres",
  },
];

const appartementStudioFields: FieldConfig[] = [
  ...habitationBaseFields,
  {
    id: "etage",
    label: "Étage",
    type: "number",
    step: 3,
    placeholder: "0 = RDC",
    helpKey: "etage",
    visibleWhen: {
      field: "type_bien",
      in: ["appartement", "studio"],
    },
  },
  {
    id: "ascenseur",
    label: "Ascenseur",
    type: "radio",
    step: 3,
    options: [
      { value: true, label: "Oui" },
      { value: false, label: "Non" },
    ],
    visibleWhen: {
      field: "type_bien",
      in: ["appartement", "studio"],
    },
  },
  {
    id: "meuble",
    label: "Meublé",
    type: "radio",
    step: 3,
    options: [
      { value: true, label: "Oui" },
      { value: false, label: "Non" },
    ],
    visibleWhen: {
      field: "type_bien",
      in: ["appartement", "studio"],
    },
  },
  {
    id: "has_balcon",
    label: "Balcon",
    type: "checkbox",
    step: 3,
    visibleWhen: {
      field: "type_bien",
      in: ["appartement", "studio"],
    },
  },
  {
    id: "has_terrasse",
    label: "Terrasse",
    type: "checkbox",
    step: 3,
  },
  {
    id: "has_jardin",
    label: "Jardin",
    type: "checkbox",
    step: 3,
    visibleWhen: {
      field: "type_bien",
      in: ["maison", "colocation"],
    },
  },
  {
    id: "has_cave",
    label: "Cave",
    type: "checkbox",
    step: 3,
  },
  // Chauffage & confort (Bloc B)
  {
    id: "chauffage_type",
    label: "Type de chauffage",
    type: "select",
    required: true,
    step: 3,
    options: [
      { value: "individuel", label: "Individuel" },
      { value: "collectif", label: "Collectif" },
      { value: "aucun", label: "Aucun" },
    ],
    helpKey: "chauffage_type",
  },
  {
    id: "chauffage_energie",
    label: "Énergie de chauffage",
    type: "select",
    step: 3,
    options: [
      { value: "electricite", label: "Électricité" },
      { value: "gaz", label: "Gaz" },
      { value: "fioul", label: "Fioul" },
      { value: "bois", label: "Bois / granulés" },
      { value: "reseau_urbain", label: "Réseau urbain" },
      { value: "autre", label: "Autre" },
    ],
    visibleWhen: {
      field: "chauffage_type",
      notEquals: "aucun",
    },
    helpKey: "chauffage_energie",
  },
  {
    id: "eau_chaude_type",
    label: "Eau chaude",
    type: "select",
    required: true,
    step: 3,
    options: [
      { value: "electrique_indiv", label: "Électrique individuel" },
      { value: "gaz_indiv", label: "Gaz individuel" },
      { value: "collectif", label: "Collectif" },
      { value: "solaire", label: "Solaire" },
      { value: "autre", label: "Autre" },
    ],
    helpKey: "eau_chaude_type",
  },
  {
    id: "clim_presence",
    label: "Climatisation",
    type: "radio",
    step: 3,
    options: [
      { value: "aucune", label: "Aucune" },
      { value: "mobile", label: "Mobile" },
      { value: "fixe", label: "Fixe" },
    ],
    helpKey: "clim_presence",
  },
  {
    id: "clim_type",
    label: "Type de climatisation",
    type: "select",
    step: 3,
    options: [
      { value: "split", label: "Split" },
      { value: "gainable", label: "Gainable" },
    ],
    visibleWhen: {
      field: "clim_presence",
      equals: "fixe",
    },
    helpKey: "clim_type",
  },
  // Équipements (Bloc C - sera géré par un composant dédié)
  {
    id: "equipments",
    label: "Équipements",
    type: "array",
    step: 3,
    helpKey: "equipments",
  },
  // Conditions de location
  {
    id: "loyer_hc",
    label: "Loyer hors charges (€ / mois)",
    type: "number",
    required: true,
    step: 5,
    min: 0,
    helpKey: "loyer_hc",
  },
  {
    id: "charges_mensuelles",
    label: "Charges mensuelles (€ / mois)",
    type: "number",
    required: true,
    step: 5,
    min: 0,
    helpKey: "charges_mensuelles",
  },
  {
    id: "depot_garantie",
    label: "Dépôt de garantie (€)",
    type: "number",
    required: true,
    step: 5,
    min: 0,
    helpKey: "depot_garantie",
  },
  {
    id: "type_bail",
    label: "Type de bail",
    type: "select",
    step: 5,
    options: [
      { value: "vide", label: "Habitation vide" },
      { value: "meuble", label: "Habitation meublée" },
      { value: "colocation", label: "Colocation" },
    ],
    visibleWhen: {
      field: "type_bien",
      in: ["appartement", "maison", "studio", "colocation"],
    },
    helpKey: "type_bail_habitation",
  },
  {
    id: "preavis_mois",
    label: "Préavis (mois)",
    type: "select",
    step: 5,
    options: [
      { value: 1, label: "1 mois" },
      { value: 3, label: "3 mois" },
      { value: 6, label: "6 mois" },
    ],
    helpKey: "preavis_mois",
  },
];

// 4.2. PARKING / BOX
// Source modèle V3 section 2.4.2

const parkingBoxFields: FieldConfig[] = [
  ...commonAddressFields,
  {
    id: "parking_type",
    label: "Type de stationnement",
    type: "select",
    required: true,
    step: 3,
    options: [
      { value: "place_exterieure", label: "Place extérieure" },
      { value: "place_couverte", label: "Place couverte" },
      { value: "box", label: "Box" },
      { value: "souterrain", label: "Souterrain" },
    ],
    helpKey: "parking_type",
  },
  {
    id: "parking_numero",
    label: "Numéro / repère",
    type: "text",
    step: 3,
    placeholder: "Ex: B12, 45",
    helpKey: "parking_numero",
  },
  {
    id: "parking_niveau",
    label: "Niveau",
    type: "text",
    step: 3,
    placeholder: "Ex: SS-1, RDC, +1",
    helpKey: "parking_niveau",
  },
  {
    id: "parking_gabarit",
    label: "Gabarit véhicule",
    type: "select",
    required: true,
    step: 3,
    options: [
      { value: "citadine", label: "Citadine" },
      { value: "berline", label: "Berline" },
      { value: "suv", label: "SUV" },
      { value: "utilitaire", label: "Utilitaire" },
      { value: "2_roues", label: "2 roues" },
    ],
    helpKey: "parking_gabarit",
  },
  {
    id: "parking_acces",
    label: "Types d'accès",
    type: "array",
    step: 3,
    options: [
      { value: "badge", label: "Badge" },
      { value: "telecommande", label: "Télécommande" },
      { value: "cle", label: "Clé" },
      { value: "digicode", label: "Digicode" },
      { value: "acces_libre", label: "Accès libre" },
    ],
    helpKey: "parking_acces",
  },
  {
    id: "parking_portail_securise",
    label: "Portail sécurisé",
    type: "checkbox",
    step: 3,
  },
  {
    id: "parking_video_surveillance",
    label: "Vidéo surveillance",
    type: "checkbox",
    step: 3,
  },
  {
    id: "parking_gardien",
    label: "Gardien",
    type: "checkbox",
    step: 3,
  },
  {
    id: "loyer_hc",
    label: "Loyer hors charges (€ / mois)",
    type: "number",
    required: true,
    step: 5,
    min: 0,
  },
  {
    id: "charges_mensuelles",
    label: "Charges mensuelles (€ / mois)",
    type: "number",
    required: true,
    step: 5,
    min: 0,
  },
  {
    id: "depot_garantie",
    label: "Dépôt de garantie (€)",
    type: "number",
    required: true,
    step: 5,
    min: 0,
  },
  {
    id: "type_bail",
    label: "Type de bail",
    type: "select",
    step: 5,
    options: [
      { value: "parking_seul", label: "Parking seul" },
      { value: "accessoire_logement", label: "Accessoire à un logement" },
    ],
    visibleWhen: {
      field: "type_bien",
      in: ["parking", "box"],
    },
  },
];

// 4.3. LOCAL COMMERCIAL / BUREAUX / ENTREPÔT / FONDS
// Source modèle V3 section 2.4.3

const localProFields: FieldConfig[] = [
  ...commonAddressFields,
  {
    id: "local_surface_totale",
    label: "Surface totale (m²)",
    type: "number",
    required: true,
    step: 3,
    min: 1,
    helpKey: "local_surface_totale",
  },
  {
    id: "local_type",
    label: "Type de local",
    type: "select",
    required: true,
    step: 3,
    options: [
      { value: "boutique", label: "Boutique" },
      { value: "restaurant", label: "Restaurant" },
      { value: "bureaux", label: "Bureaux" },
      { value: "atelier", label: "Atelier" },
      { value: "stockage", label: "Stockage" },
      { value: "autre", label: "Autre" },
    ],
    helpKey: "local_type",
  },
  {
    id: "local_has_vitrine",
    label: "Vitrine",
    type: "checkbox",
    step: 3,
  },
  {
    id: "local_access_pmr",
    label: "Accessibilité PMR",
    type: "checkbox",
    step: 3,
  },
  {
    id: "local_clim",
    label: "Climatisation",
    type: "checkbox",
    step: 3,
  },
  {
    id: "local_fibre",
    label: "Fibre optique",
    type: "checkbox",
    step: 3,
  },
  {
    id: "local_alarme",
    label: "Alarme",
    type: "checkbox",
    step: 3,
  },
  {
    id: "local_rideau_metal",
    label: "Rideau métallique",
    type: "checkbox",
    step: 3,
  },
  {
    id: "local_acces_camion",
    label: "Accès camion",
    type: "checkbox",
    step: 3,
  },
  {
    id: "local_parking_clients",
    label: "Parking clients",
    type: "checkbox",
    step: 3,
  },
  {
    id: "loyer_hc",
    label: "Loyer hors charges (€)",
    type: "number",
    required: true,
    step: 5,
    min: 0,
    placeholder: "Mensuel ou annuel selon le contexte",
  },
  {
    id: "charges_mensuelles",
    label: "Charges (€)",
    type: "number",
    required: true,
    step: 5,
    min: 0,
  },
  {
    id: "depot_garantie",
    label: "Dépôt de garantie (€)",
    type: "number",
    required: true,
    step: 5,
    min: 0,
  },
  {
    id: "type_bail",
    label: "Type de bail",
    type: "select",
    step: 5,
    options: [
      { value: "3_6_9", label: "Bail commercial 3-6-9" },
      { value: "derogatoire", label: "Bail dérogatoire" },
      { value: "precaire", label: "Bail précaire" },
      { value: "professionnel", label: "Bail professionnel" },
      { value: "autre", label: "Autre" },
    ],
    visibleWhen: {
      field: "type_bien",
      in: ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"],
    },
  },
];

// ============================================
// 5. CONFIGURATION FINALE
// ============================================

export const propertyWizardConfigV3: WizardConfigV3 = {
  steps: WIZARD_STEPS_V3,
  fieldsByType: {
    appartement: appartementStudioFields,
    maison: appartementStudioFields,
    studio: appartementStudioFields,
    colocation: appartementStudioFields,
    saisonnier: appartementStudioFields, // Ajout pour compatibilité
    parking: parkingBoxFields,
    box: parkingBoxFields,
    local_commercial: localProFields,
    bureaux: localProFields,
    entrepot: localProFields,
    fonds_de_commerce: localProFields,
    immeuble: [],
    terrain_agricole: [],
    exploitation_agricole: [],
  },
};

export type PropertyWizardConfigV3Type = typeof propertyWizardConfigV3;

