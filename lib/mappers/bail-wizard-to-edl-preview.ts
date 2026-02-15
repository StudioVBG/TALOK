/**
 * Fonction de mapping : données wizard bail → format EDLComplet partiel
 *
 * Transforme les données collectées dans le wizard de création de bail
 * vers le format attendu par le composant EDLPreview et la fonction
 * generateEDLViergeHTML, permettant de prévisualiser l'état des lieux
 * d'entrée directement depuis le wizard.
 *
 * @module bail-wizard-to-edl-preview
 */

import type { EDLComplet, ItemCondition } from "@/lib/templates/edl/types";

// ---------------------------------------------------------------------------
// Types d'entrée
// ---------------------------------------------------------------------------

/** Données du bien immobilier provenant du wizard */
interface WizardProperty {
  adresse_complete?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  type?: string;
  surface?: number;
  surface_habitable_m2?: number | null;
  nb_pieces?: number;
  etage?: number;
  numero_lot?: string;
}

/** Données du bailleur provenant du wizard */
interface WizardBailleur {
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  type?: string;
  raison_sociale?: string;
}

/** Données d'un locataire provenant du wizard */
interface WizardLocataire {
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
}

/**
 * Données d'entrée provenant du wizard de création de bail.
 * Tous les champs sont potentiellement incomplets puisque le wizard
 * est en cours de remplissage.
 */
export interface BailWizardEdlInput {
  /** Propriété sélectionnée (null si pas encore sélectionnée) */
  property: WizardProperty | null;
  /** Informations du bailleur */
  bailleur: WizardBailleur;
  /** Liste des locataires */
  locataires: WizardLocataire[];
  /** Type de bail sélectionné */
  typeBail: string;
  /** Loyer hors charges */
  loyer: number;
  /** Montant des charges */
  charges: number;
  /** Date de début du bail (YYYY-MM-DD) */
  dateDebut: string;
  /** Date de fin du bail (YYYY-MM-DD) — null si reconduction tacite */
  dateFin?: string | null;
}

// ---------------------------------------------------------------------------
// Items par défaut par type de pièce
// ---------------------------------------------------------------------------

/** Items de base présents dans la plupart des pièces */
const BASE_ITEMS = [
  "Sol", "Murs", "Plafond", "Fenêtre(s)", "Porte", "Éclairage",
  "Prises électriques", "Radiateur/Chauffage",
];

/** Configuration des pièces avec leurs items par défaut */
const ROOM_ITEMS_CONFIG: Record<string, string[]> = {
  "Entrée": ["Porte d'entrée", "Serrure", "Sonnette/Interphone", ...BASE_ITEMS, "Placard"],
  "Salon / Séjour": [...BASE_ITEMS, "Volets/Stores", "Placard"],
  "Pièce principale": [...BASE_ITEMS, "Volets/Stores"],
  "Cuisine": [...BASE_ITEMS, "Évier", "Robinetterie", "Plan de travail", "Plaques de cuisson", "Four", "Hotte", "Placards"],
  "Cuisine / Kitchenette": [...BASE_ITEMS, "Évier", "Robinetterie", "Plan de travail", "Plaques de cuisson", "Placards"],
  "Chambre": [...BASE_ITEMS, "Volets/Stores", "Placard"],
  "Salle de bain": [...BASE_ITEMS, "Baignoire/Douche", "Lavabo", "Robinetterie", "Miroir", "Ventilation"],
  "Salle de bain / WC": [...BASE_ITEMS, "Baignoire/Douche", "Lavabo", "Robinetterie", "Miroir", "Ventilation", "Cuvette", "Chasse d'eau"],
  "WC": ["Sol", "Murs", "Plafond", "Porte", "Cuvette", "Chasse d'eau", "Lave-mains", "Ventilation", "Éclairage"],
  "Garage / Cellier": ["Porte/Accès", ...BASE_ITEMS],
  "Garage / Parking": ["Porte/Accès", ...BASE_ITEMS],
  "Cave / Cellier": ["Porte/Accès", ...BASE_ITEMS],
  "Extérieur / Jardin": ["Portail/Clôture", "Allées", "Pelouse", "Terrasse", "Éclairage extérieur"],
};

/** Items supplémentaires pour bail meublé (inventaire mobilier requis par la loi) */
const MEUBLE_ITEMS_BY_ROOM: Record<string, string[]> = {
  "Salon / Séjour": ["Canapé", "Table", "Chaise(s)", "Luminaire", "Rideaux/Stores"],
  "Pièce principale": ["Canapé", "Table", "Chaise(s)", "Luminaire", "Rideaux/Stores"],
  "Chambre": ["Lit", "Matelas", "Couette/Couverture", "Table de chevet", "Armoire/Penderie", "Luminaire"],
  "Cuisine": ["Réfrigérateur", "Micro-ondes", "Vaisselle", "Ustensiles de cuisine"],
  "Cuisine / Kitchenette": ["Réfrigérateur", "Micro-ondes", "Vaisselle", "Ustensiles de cuisine"],
};

// ---------------------------------------------------------------------------
// Fonctions utilitaires
// ---------------------------------------------------------------------------

/**
 * Génère une liste de pièces par défaut basée sur le nombre de pièces
 * principales du bien et son type.
 *
 * @param nbPieces - Nombre de pièces principales du bien
 * @param typeBien - Type de bien (appartement, maison, studio…)
 * @returns Liste ordonnée des noms de pièces
 */
export function generateDefaultRooms(
  nbPieces: number | undefined,
  typeBien?: string
): string[] {
  // Studio / T1
  if (!nbPieces || nbPieces <= 1) {
    return [
      "Entrée",
      "Pièce principale",
      "Cuisine / Kitchenette",
      "Salle de bain / WC",
    ];
  }

  const rooms: string[] = ["Entrée", "Salon / Séjour"];

  // Chambres
  const nbChambres = Math.max(1, nbPieces - 1);
  for (let i = 1; i <= nbChambres; i++) {
    rooms.push(nbChambres === 1 ? "Chambre" : `Chambre ${i}`);
  }

  rooms.push("Cuisine");
  rooms.push("Salle de bain");

  if (nbPieces >= 3) {
    rooms.push("WC");
  }

  // Pour les maisons, ajouter des pièces supplémentaires courantes
  if (typeBien === "maison") {
    rooms.push("Garage / Cellier");
  }

  return rooms;
}

/**
 * Retourne les items par défaut pour une pièce donnée.
 * Si le nom de pièce contient un numéro (ex: "Chambre 2"),
 * on utilise le template de base (ex: "Chambre").
 */
function getItemsForRoom(roomName: string, typeBail?: string): string[] {
  // Recherche exacte
  let items = ROOM_ITEMS_CONFIG[roomName];

  // Si pas trouvé, chercher un match partiel (ex: "Chambre 2" → "Chambre")
  if (!items) {
    const baseRoomName = Object.keys(ROOM_ITEMS_CONFIG).find(key =>
      roomName.startsWith(key)
    );
    items = baseRoomName ? ROOM_ITEMS_CONFIG[baseRoomName] : BASE_ITEMS;
  }

  // Pour les baux meublés (meublé, colocation, saisonnier, étudiant), ajouter les items de mobilier
  // Le bail saisonnier est par nature toujours meublé (art. L324-1 Code du tourisme)
  if (typeBail === "meuble" || typeBail === "colocation" || typeBail === "etudiant" || typeBail === "saisonnier") {
    const meubleItems = MEUBLE_ITEMS_BY_ROOM[roomName]
      || MEUBLE_ITEMS_BY_ROOM[Object.keys(MEUBLE_ITEMS_BY_ROOM).find(key => roomName.startsWith(key)) || ""]
      || [];
    if (meubleItems.length > 0) {
      items = [...items, ...meubleItems];
    }
  }

  return items;
}

/**
 * Génère les pièces pré-remplies avec items vierges (condition: null)
 * pour l'aperçu dans le wizard de bail.
 */
export function generatePreviewPieces(
  rooms: string[],
  typeBail?: string
): Array<{
  nom: string;
  items: Array<{
    room_name: string;
    item_name: string;
    condition: ItemCondition | null;
    notes?: string;
  }>;
}> {
  return rooms.map(roomName => ({
    nom: roomName,
    items: getItemsForRoom(roomName, typeBail).map(itemName => ({
      room_name: roomName,
      item_name: itemName,
      condition: null as ItemCondition | null,
      notes: undefined,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Compteurs par défaut
// ---------------------------------------------------------------------------

/** Compteurs standards pour le preview */
function generateDefaultCompteurs(): Array<{
  type: "electricity" | "gas" | "water" | "water_hot";
  meter_number: string;
  reading: string;
  unit: string;
}> {
  return [
    { type: "electricity", meter_number: "", reading: "—", unit: "kWh" },
    { type: "water", meter_number: "", reading: "—", unit: "m³" },
  ];
}

/** Clés par défaut pour le preview */
function generateDefaultKeys(): Array<{ type: string; quantite: number; notes: string }> {
  return [
    { type: "Clé Porte d'entrée", quantite: 0, notes: "" },
    { type: "Badge Immeuble", quantite: 0, notes: "" },
    { type: "Clé Boîte aux lettres", quantite: 0, notes: "" },
  ];
}

// ---------------------------------------------------------------------------
// Fonction de mapping principale
// ---------------------------------------------------------------------------

/**
 * Mappe les données du wizard de création de bail vers le format
 * `Partial<EDLComplet>` attendu par le composant EDLPreview.
 *
 * Gère gracieusement les champs manquants en utilisant des placeholders
 * explicites ("Non renseigné") plutôt que des chaînes vides.
 *
 * @param data - Données collectées dans le wizard de bail
 * @returns Objet partiel EDLComplet prêt pour la prévisualisation
 */
export function mapBailWizardToEdlPreview(
  data: BailWizardEdlInput
): Partial<EDLComplet> {
  const surface =
    data.property?.surface_habitable_m2 ?? data.property?.surface;

  // Construire le nom complet du bailleur
  const isSociete = data.bailleur.type === "societe";
  const baileurNomComplet = isSociete
    ? data.bailleur.raison_sociale || "Non renseigné"
    : [data.bailleur.prenom, data.bailleur.nom]
        .filter(Boolean)
        .join(" ") || "Non renseigné";

  // Mapper les locataires avec gestion des placeholders
  const locataires =
    data.locataires.length > 0
      ? data.locataires.map((l) => {
          const nomComplet =
            [l.prenom, l.nom].filter(Boolean).join(" ") ||
            l.nom ||
            "Non renseigné";
          return {
            nom: l.nom || "Non renseigné",
            prenom: l.prenom || "",
            nom_complet: nomComplet,
            email: l.email || undefined,
            telephone: l.telephone || undefined,
          };
        })
      : [];

  // Générer les pièces par défaut avec items pré-remplis
  const rooms = generateDefaultRooms(data.property?.nb_pieces, data.property?.type);
  const pieces = generatePreviewPieces(rooms, data.typeBail);

  return {
    type: "entree",
    reference: "APERCU-EDL",
    created_at: new Date().toISOString(),
    scheduled_date: data.dateDebut || undefined,

    logement: {
      adresse_complete:
        data.property?.adresse_complete ||
        data.property?.adresse ||
        "Non renseigné",
      code_postal: data.property?.code_postal || "",
      ville: data.property?.ville || "",
      type_bien: data.property?.type || "appartement",
      surface: surface || undefined,
      nb_pieces: data.property?.nb_pieces || undefined,
      etage: data.property?.etage?.toString() || undefined,
      numero_lot: data.property?.numero_lot || undefined,
    },

    bailleur: {
      type: isSociete ? "societe" : "particulier",
      nom_complet: baileurNomComplet,
      raison_sociale: isSociete
        ? data.bailleur.raison_sociale || undefined
        : undefined,
      telephone: data.bailleur.telephone || undefined,
      email: data.bailleur.email || undefined,
    },

    locataires,

    bail: {
      id: "brouillon",
      reference: "BROUILLON",
      type_bail: data.typeBail || "",
      date_debut: data.dateDebut || "",
      date_fin: data.dateFin || undefined,
      loyer_hc: data.loyer || 0,
      charges: data.charges || 0,
    },

    // Pièces pré-remplies avec items standards (condition non évaluée)
    compteurs: generateDefaultCompteurs(),
    pieces,
    signatures: [],
    cles_remises: generateDefaultKeys(),
    observations_generales: undefined,
    is_complete: false,
    is_signed: false,
    status: "draft",
  };
}
