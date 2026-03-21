/**
 * SOTA 2026 — Mapper : etat du wizard → donnees de preview du bail
 *
 * Extrait du monolithe LeaseWizard.tsx pour etre reutilisable et testable.
 */

import type { BailComplet } from "@/lib/templates/bail/types";
import type { LeaseWizardState } from "@/features/leases/stores/lease-wizard.store";

interface PropertyLike {
  id: string;
  adresse_complete?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  type?: string;
  surface?: number;
  surface_habitable_m2?: number | null;
  nb_pieces?: number;
  etage?: number;
  annee_construction?: number | null;
  dpe_classe_energie?: string | null;
  dpe_classe_climat?: string | null;
  dpe_consommation?: number | null;
  dpe_estimation_conso_min?: number | null;
  dpe_estimation_conso_max?: number | null;
  energie?: string;
  ges?: string;
  chauffage_type?: string | null;
  eau_chaude_type?: string | null;
}

interface ProfileLike {
  nom?: string | null;
  prenom?: string | null;
  telephone?: string | null;
  email?: string | null;
}

interface EntityLike {
  id: string;
  nom?: string;
  siret?: string | null;
  legalForm?: string;
}

interface OwnerProfileLike {
  type?: string;
  adresse_facturation?: string;
}

export interface WizardPreviewContext {
  property: PropertyLike;
  state: LeaseWizardState;
  profile: ProfileLike | null;
  ownerProfile: OwnerProfileLike | null;
  selectedEntity: EntityLike | null;
  dateFin: string | null;
  effectiveDurationMonths: number;
  numberToWords: (n: number) => string;
}

export function mapWizardToPreviewData(ctx: WizardPreviewContext): Partial<BailComplet> {
  const { property, state, profile, ownerProfile, selectedEntity, dateFin, effectiveDurationMonths, numberToWords } = ctx;
  const isColocation = state.typeBail === "colocation";

  const surface = property.surface_habitable_m2 || property.surface;
  const surfaceValid = surface && surface > 0 ? surface : undefined;

  const bailleur = selectedEntity
    ? {
        nom: selectedEntity.nom || undefined,
        prenom: "",
        adresse: undefined as string | undefined,
        code_postal: "",
        ville: "",
        telephone: profile?.telephone || undefined,
        email: profile?.email || undefined,
        type: "societe" as const,
        raison_sociale: selectedEntity.nom,
        forme_juridique: selectedEntity.legalForm || "",
        siret: selectedEntity.siret || "",
      }
    : {
        nom: profile?.nom || undefined,
        prenom: profile?.prenom || undefined,
        adresse: ownerProfile?.adresse_facturation || undefined,
        code_postal: "",
        ville: "",
        telephone: profile?.telephone || undefined,
        email: profile?.email || undefined,
        type: (ownerProfile?.type || "particulier") as any,
      };

  const locataires = isColocation
    ? state.invitees.map((i) => ({
        nom: i.name || "____________________",
        prenom: "",
        email: i.email,
        telephone: "",
        date_naissance: undefined as string | undefined,
        lieu_naissance: "",
        nationalite: "",
      }))
    : [
        {
          nom: state.tenantName || (state.creationMode === "manual" ? "____________________" : "[NOM LOCATAIRE]"),
          prenom: "",
          email: state.tenantEmail,
          telephone: "",
          date_naissance: undefined as string | undefined,
          lieu_naissance: "",
          nationalite: "",
        },
      ];

  const logement = {
    adresse_complete: property.adresse_complete || property.adresse || "",
    code_postal: property.code_postal || "",
    ville: property.ville || "",
    type: property.type || "appartement",
    surface_habitable: surfaceValid,
    nb_pieces_principales: property.nb_pieces || 1,
    etage: property.etage,
    epoque_construction: property.annee_construction ? String(property.annee_construction) : undefined,
    chauffage_type: property.chauffage_type || undefined,
    eau_chaude_type: property.eau_chaude_type || undefined,
    equipements_privatifs: [
      ...(state.wizardDigicode ? [`Digicode : ${state.wizardDigicode}`] : []),
      ...(state.wizardInterphone ? [`Interphone : ${state.wizardInterphone}`] : []),
    ],
    parties_communes: [],
    annexes: [],
  };

  const conditions = {
    date_debut: state.dateDebut,
    date_fin: dateFin || undefined,
    duree_mois: effectiveDurationMonths,
    tacite_reconduction: true,
    loyer_hc: state.loyer,
    loyer_en_lettres: numberToWords(state.loyer),
    charges_montant: state.charges,
    charges_type: state.chargesType,
    depot_garantie: state.depot,
    depot_garantie_en_lettres: numberToWords(state.depot),
    mode_paiement: "virement",
    periodicite_paiement: "mensuelle",
    jour_paiement: state.jourPaiement,
    paiement_avance: true,
    revision_autorisee: true,
  };

  const diagnostics = {
    dpe: {
      date_realisation: undefined as string | undefined,
      classe_energie: property.dpe_classe_energie || property.energie || undefined,
      classe_ges: property.dpe_classe_climat || property.ges || undefined,
      consommation_energie: property.dpe_consommation || undefined,
      estimation_cout_min: property.dpe_estimation_conso_min || undefined,
      estimation_cout_max: property.dpe_estimation_conso_max || undefined,
    },
  };

  const garants =
    state.hasGarant && state.garant
      ? [
          {
            nom: state.garant.nom,
            prenom: state.garant.prenom,
            adresse: state.garant.adresse,
            code_postal: state.garant.code_postal,
            ville: state.garant.ville,
            email: state.garant.email,
            telephone: state.garant.telephone,
            type_garantie: state.garant.type_garantie,
            date_naissance: state.garant.date_naissance,
            lieu_naissance: state.garant.lieu_naissance,
            lien_parente: state.garant.lien_parente,
            raison_sociale: state.garant.raison_sociale,
            siret: state.garant.siret,
          },
        ]
      : undefined;

  return {
    reference: "BROUILLON",
    date_signature: undefined,
    lieu_signature: property.ville || "...",
    bailleur: bailleur as any,
    locataires: locataires as any,
    logement: logement as any,
    conditions: conditions as any,
    diagnostics: diagnostics as any,
    clauses: {
      activite_professionnelle_autorisee: false,
      animaux_autorises: true,
      sous_location_autorisee: false,
      travaux_autorises: false,
      assurance_obligatoire: true,
      clauses_additionnelles: state.customClauses.length > 0 ? state.customClauses.map((c) => c.text) : undefined,
    } as any,
    garants: garants as any,
  };
}
