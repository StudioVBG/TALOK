/**
 * Taux de TVA applicables aux travaux dans un logement.
 *
 * Différent de la TVA SaaS (lib/billing/tva.ts) :
 *   - Travaux logement habitation > 2 ans : 10% (art. 279-0 bis CGI)
 *   - Rénovation énergétique avec attestation : 5.5% (art. 278-0 bis A CGI)
 *   - Travaux logement < 2 ans ou local commercial : 20% (taux normal)
 *   - DROM : 8.5% Antilles + Réunion, 2.1% Guyane, 0% Mayotte
 *
 * Source : https://bofip.impots.gouv.fr/bofip/2099-PGP.html
 */

import { getDepartementCodeFromCP } from "@/lib/helpers/address-utils";

export type WorkType =
  | "entretien" // Entretien courant — taux réduit
  | "amelioration" // Amélioration / pose équipement — taux réduit
  | "renovation_energetique" // Rénovation énergétique avec attestation — super réduit
  | "construction" // Construction neuve / surélévation — taux normal
  | "autre"; // Cas non clair — taux normal

export type TVATravauxResult = {
  /** Taux décimal (ex: 0.10 pour 10%) */
  rate: number;
  /** Taux affichable ("10 %", "8,5 %"…) */
  formatted: string;
  /** Code interne du régime appliqué */
  regime:
    | "metropole_normal" // 20%
    | "metropole_reduit" // 10%
    | "metropole_super_reduit" // 5.5%
    | "drom_antilles_reunion" // 8.5%
    | "drom_guyane" // 2.1%
    | "drom_mayotte"; // 0%
  /** Référence légale */
  reference: string;
};

interface ResolveTVAParams {
  /** Code postal du bien (utilisé pour DROM) */
  codePostal: string | null | undefined;
  /** Année de construction du logement (pour règle des 2 ans) */
  propertyBuildYear: number | null | undefined;
  /** Type de travaux */
  workType: WorkType;
  /** S'il s'agit d'un local commercial, on force le taux normal métropole */
  isCommercial?: boolean;
  /** Override manuel du taux (par le prestataire) — bypass tout */
  overrideRate?: number | null;
}

const PCT = (rate: number) => {
  const v = rate * 100;
  const formatted =
    v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(".", ",");
  return `${formatted} %`;
};

/**
 * Résout le taux de TVA applicable pour des travaux selon :
 * - localisation du bien (métropole vs DROM)
 * - âge du logement (2 ans = règle clé)
 * - type de travaux
 */
export function resolveWorkOrderTVA(params: ResolveTVAParams): TVATravauxResult {
  const {
    codePostal,
    propertyBuildYear,
    workType,
    isCommercial = false,
    overrideRate,
  } = params;

  // Override manuel par le prestataire
  if (overrideRate !== null && overrideRate !== undefined) {
    return {
      rate: overrideRate,
      formatted: PCT(overrideRate),
      regime: "metropole_normal", // n'a pas de sens technique mais respecte le type
      reference: "Taux saisi par le prestataire",
    };
  }

  // 1. DROM : règle territoriale prioritaire (art. 296 et 296 ter CGI)
  const dept = getDepartementCodeFromCP(codePostal);
  if (dept === "976") {
    return {
      rate: 0,
      formatted: PCT(0),
      regime: "drom_mayotte",
      reference: "Pas de TVA à Mayotte (art. 1er-1° bis CGI)",
    };
  }
  if (dept === "973") {
    return {
      rate: 0.021,
      formatted: PCT(0.021),
      regime: "drom_guyane",
      reference: "TVA 2,1 % Guyane (art. 296 CGI)",
    };
  }
  if (dept && ["971", "972", "974"].includes(dept)) {
    return {
      rate: 0.085,
      formatted: PCT(0.085),
      regime: "drom_antilles_reunion",
      reference: "TVA 8,5 % Antilles/Réunion (art. 296 CGI)",
    };
  }

  // 2. Métropole : taux normal pour locaux non-habitation, neufs, ou
  //    travaux non éligibles
  if (isCommercial || workType === "construction" || workType === "autre") {
    return {
      rate: 0.20,
      formatted: PCT(0.20),
      regime: "metropole_normal",
      reference: "TVA 20 % (art. 278 CGI)",
    };
  }

  // 3. Règle des 2 ans : si logement < 2 ans, taux normal
  const currentYear = new Date().getFullYear();
  const ageYears = propertyBuildYear
    ? currentYear - propertyBuildYear
    : null;
  if (ageYears !== null && ageYears < 2) {
    return {
      rate: 0.20,
      formatted: PCT(0.20),
      regime: "metropole_normal",
      reference: "Logement < 2 ans : TVA 20 % (art. 279-0 bis CGI a contrario)",
    };
  }

  // 4. Rénovation énergétique : taux super réduit avec attestation
  if (workType === "renovation_energetique") {
    return {
      rate: 0.055,
      formatted: PCT(0.055),
      regime: "metropole_super_reduit",
      reference:
        "TVA 5,5 % rénovation énergétique (art. 278-0 bis A CGI), sous attestation",
    };
  }

  // 5. Entretien / amélioration logement > 2 ans : taux réduit 10%
  return {
    rate: 0.10,
    formatted: PCT(0.10),
    regime: "metropole_reduit",
    reference: "TVA 10 % travaux logement > 2 ans (art. 279-0 bis CGI)",
  };
}

/**
 * Calcule la ventilation HT / TVA / TTC depuis un montant TTC + un taux.
 * Utile pour générer la facture PDF quand le devis stocke seulement le TTC.
 */
export function splitFromTTC(
  ttcCents: number,
  rate: number,
): { htCents: number; tvaCents: number; ttcCents: number } {
  const htCents = Math.round(ttcCents / (1 + rate));
  return {
    htCents,
    tvaCents: ttcCents - htCents,
    ttcCents,
  };
}
