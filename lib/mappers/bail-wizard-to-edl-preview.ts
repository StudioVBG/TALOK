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

import type { EDLComplet } from "@/lib/templates/edl/types";

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
 *
 * @example
 * ```ts
 * const edlData = mapBailWizardToEdlPreview({
 *   property: selectedProperty,
 *   bailleur: { nom: "Dupont", prenom: "Jean" },
 *   locataires: [{ nom: "Martin", email: "a@b.com" }],
 *   typeBail: "meuble",
 *   loyer: 850,
 *   charges: 50,
 *   dateDebut: "2026-03-01",
 * });
 * ```
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

    // Sections vides — seront remplies lors de l'état des lieux réel
    compteurs: [],
    pieces: [],
    signatures: [],
    cles_remises: [],
    observations_generales: undefined,
    is_complete: false,
    is_signed: false,
    status: "draft",
  };
}
