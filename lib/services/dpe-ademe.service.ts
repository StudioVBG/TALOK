/**
 * Service de vérification DPE via l'API ADEME
 *
 * L'ADEME (Agence de l'Environnement et de la Maîtrise de l'Énergie) fournit
 * une API publique pour vérifier la validité des DPE.
 *
 * Documentation: https://data.ademe.fr/datasets/dpe-v2-logements-existants
 *
 * Restrictions de location selon le DPE:
 * - Classe G: Interdit depuis le 1er janvier 2025
 * - Classe F: Interdit à partir du 1er janvier 2028
 * - Classe E: Interdit à partir du 1er janvier 2034
 */

import { createClient } from "@/lib/supabase/client";

// Types
export interface DPEData {
  numero_dpe: string;
  date_etablissement: string;
  date_fin_validite: string;
  version: string;
  methode: "3CL" | "facture" | null;
  type_batiment: string;

  // Localisation
  adresse: string;
  code_postal: string;
  commune: string;

  // Résultats
  classe_energie: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  classe_ges: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  consommation_energie: number; // kWh/m²/an
  emission_ges: number; // kgCO2/m²/an

  // Coûts estimés
  cout_chauffage_min: number;
  cout_chauffage_max: number;

  // Surface
  surface_habitable: number;

  // Diagnostiqueur
  diagnostiqueur?: {
    nom: string;
    certification: string;
  };
}

export interface DPEVerificationResult {
  valid: boolean;
  data?: DPEData;
  message: string;
  rentalEligibility: {
    eligible: boolean;
    reason?: string;
    futureRestriction?: Date;
  };
}

export interface DPERentalEligibility {
  eligible: boolean;
  reason?: string;
  futureRestriction?: Date;
  classeEnergie: string;
}

// URL de l'API ADEME
const ADEME_API_BASE = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants";

/**
 * Vérifie un DPE via son numéro ADEME
 */
export async function verifyDPE(numeroDPE: string): Promise<DPEVerificationResult> {
  try {
    // Nettoyer le numéro (enlever espaces, tirets)
    const cleanNumber = numeroDPE.replace(/[\s-]/g, "").toUpperCase();

    // Vérifier le format (13 caractères alphanumériques)
    if (!/^[A-Z0-9]{13}$/.test(cleanNumber)) {
      return {
        valid: false,
        message: "Format du numéro DPE invalide. Attendu: 13 caractères alphanumériques",
        rentalEligibility: { eligible: true },
      };
    }

    // Appeler l'API ADEME
    const response = await fetch(
      `${ADEME_API_BASE}/lines?q=${encodeURIComponent(cleanNumber)}&qs=N%C2%B0DPE`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error("Erreur API ADEME:", response.status, response.statusText);
      return {
        valid: false,
        message: "Erreur lors de la vérification avec l'API ADEME",
        rentalEligibility: { eligible: true },
      };
    }

    const result = await response.json();

    if (!result.results || result.results.length === 0) {
      return {
        valid: false,
        message: "Aucun DPE trouvé avec ce numéro. Vérifiez le numéro ou le DPE n'est peut-être pas encore enregistré.",
        rentalEligibility: { eligible: true },
      };
    }

    // Mapper les données ADEME vers notre format
    const dpeRecord = result.results[0];
    const dpeData: DPEData = {
      numero_dpe: dpeRecord["N°DPE"] || cleanNumber,
      date_etablissement: dpeRecord["Date_établissement_DPE"],
      date_fin_validite: dpeRecord["Date_fin_validité_DPE"],
      version: dpeRecord["Version_DPE"],
      methode: dpeRecord["Méthode_du_DPE"],
      type_batiment: dpeRecord["Type_bâtiment"],
      adresse: dpeRecord["Adresse_(BAN)"] || dpeRecord["Adresse_brute"],
      code_postal: dpeRecord["Code_postal_(BAN)"],
      commune: dpeRecord["Commune_(BAN)"],
      classe_energie: dpeRecord["Etiquette_DPE"],
      classe_ges: dpeRecord["Etiquette_GES"],
      consommation_energie: parseFloat(dpeRecord["Conso_5_usages_é_finale"]) || 0,
      emission_ges: parseFloat(dpeRecord["Emission_GES_5_usages"]) || 0,
      cout_chauffage_min: parseFloat(dpeRecord["Coût_total_5_usages"]) || 0,
      cout_chauffage_max: parseFloat(dpeRecord["Coût_total_5_usages"]) || 0,
      surface_habitable: parseFloat(dpeRecord["Surface_habitable_logement"]) || 0,
    };

    // Vérifier l'éligibilité à la location
    const rentalEligibility = checkRentalEligibility(dpeData.classe_energie);

    // Vérifier la validité du DPE
    const isExpired = new Date(dpeData.date_fin_validite) < new Date();

    if (isExpired) {
      return {
        valid: false,
        data: dpeData,
        message: "Ce DPE est expiré. Un nouveau diagnostic est requis.",
        rentalEligibility,
      };
    }

    return {
      valid: true,
      data: dpeData,
      message: "DPE valide et vérifié",
      rentalEligibility,
    };
  } catch (error) {
    console.error("Erreur vérification DPE:", error);
    return {
      valid: false,
      message: "Erreur lors de la vérification du DPE",
      rentalEligibility: { eligible: true },
    };
  }
}

/**
 * Recherche des DPE par adresse
 */
export async function searchDPEByAddress(params: {
  adresse?: string;
  codePostal?: string;
  ville?: string;
}): Promise<DPEData[]> {
  try {
    const queryParts: string[] = [];

    if (params.codePostal) {
      queryParts.push(`Code_postal_(BAN):${params.codePostal}`);
    }
    if (params.ville) {
      queryParts.push(`Commune_(BAN):${encodeURIComponent(params.ville)}`);
    }

    const queryString = queryParts.join(" AND ");
    const url = `${ADEME_API_BASE}/lines?qs=${encodeURIComponent(queryString)}&size=10&sort=-Date_établissement_DPE`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();

    return (result.results || []).map((record: any) => ({
      numero_dpe: record["N°DPE"],
      date_etablissement: record["Date_établissement_DPE"],
      date_fin_validite: record["Date_fin_validité_DPE"],
      version: record["Version_DPE"],
      methode: record["Méthode_du_DPE"],
      type_batiment: record["Type_bâtiment"],
      adresse: record["Adresse_(BAN)"] || record["Adresse_brute"],
      code_postal: record["Code_postal_(BAN)"],
      commune: record["Commune_(BAN)"],
      classe_energie: record["Etiquette_DPE"],
      classe_ges: record["Etiquette_GES"],
      consommation_energie: parseFloat(record["Conso_5_usages_é_finale"]) || 0,
      emission_ges: parseFloat(record["Emission_GES_5_usages"]) || 0,
      cout_chauffage_min: parseFloat(record["Coût_total_5_usages"]) || 0,
      cout_chauffage_max: parseFloat(record["Coût_total_5_usages"]) || 0,
      surface_habitable: parseFloat(record["Surface_habitable_logement"]) || 0,
    })) as DPEData[];
  } catch (error) {
    console.error("Erreur recherche DPE:", error);
    return [];
  }
}

/**
 * Vérifie l'éligibilité à la location selon la classe énergétique
 */
export function checkRentalEligibility(classeEnergie: string): DPERentalEligibility {
  const classe = classeEnergie?.toUpperCase();

  switch (classe) {
    case "G":
      return {
        eligible: false,
        reason: "Les logements classés G sont interdits à la location depuis le 1er janvier 2025",
        classeEnergie: classe,
      };

    case "F":
      return {
        eligible: true,
        reason: "Attention: location interdite à partir du 1er janvier 2028",
        futureRestriction: new Date("2028-01-01"),
        classeEnergie: classe,
      };

    case "E":
      return {
        eligible: true,
        reason: "Attention: location interdite à partir du 1er janvier 2034",
        futureRestriction: new Date("2034-01-01"),
        classeEnergie: classe,
      };

    case "D":
    case "C":
    case "B":
    case "A":
      return {
        eligible: true,
        classeEnergie: classe,
      };

    default:
      return {
        eligible: true,
        reason: "Classe énergétique non déterminée",
        classeEnergie: classe || "N/A",
      };
  }
}

/**
 * Met à jour les données DPE d'un bien après vérification
 */
export async function updatePropertyDPE(
  propertyId: string,
  dpeData: DPEData,
  verified: boolean = false
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from("properties")
    .update({
      dpe_numero: dpeData.numero_dpe,
      dpe_date_realisation: dpeData.date_etablissement,
      dpe_date_validite: dpeData.date_fin_validite,
      dpe_classe_energie: dpeData.classe_energie,
      dpe_classe_ges: dpeData.classe_ges,
      dpe_consommation_energie: dpeData.consommation_energie,
      dpe_estimation_ges: dpeData.emission_ges,
      dpe_cout_energie_min: dpeData.cout_chauffage_min,
      dpe_cout_energie_max: dpeData.cout_chauffage_max,
      dpe_methode: dpeData.methode,
      dpe_is_verified: verified,
      dpe_verification_date: verified ? new Date().toISOString() : null,
    })
    .eq("id", propertyId);

  if (error) {
    console.error("Erreur mise à jour DPE:", error);
    return false;
  }

  return true;
}

/**
 * Récupère les DPE expirant bientôt pour un propriétaire
 */
export async function getExpiringDPEs(
  ownerProfileId: string,
  daysBeforeExpiry: number = 90
): Promise<Array<{ propertyId: string; adresse: string; dateExpiration: string; daysLeft: number }>> {
  const supabase = createClient();

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysBeforeExpiry);

  const { data, error } = await supabase
    .from("properties")
    .select("id, adresse_complete, dpe_date_validite")
    .eq("owner_id", ownerProfileId)
    .not("dpe_date_validite", "is", null)
    .lte("dpe_date_validite", futureDate.toISOString().split("T")[0])
    .gte("dpe_date_validite", new Date().toISOString().split("T")[0]);

  if (error || !data) {
    return [];
  }

  const now = new Date();

  return data.map((p: any) => {
    const expDate = new Date(p.dpe_date_validite);
    const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      propertyId: p.id,
      adresse: p.adresse_complete,
      dateExpiration: p.dpe_date_validite,
      daysLeft,
    };
  });
}

/**
 * Calcule les améliorations recommandées pour atteindre une meilleure classe
 */
export function getRecommendedImprovements(
  currentClass: string,
  targetClass: string = "D"
): string[] {
  const improvements: Record<string, string[]> = {
    G: [
      "Isolation des combles et de la toiture",
      "Remplacement du système de chauffage",
      "Isolation des murs par l'extérieur (ITE)",
      "Remplacement des fenêtres simple vitrage",
      "Installation d'une VMC double flux",
      "Isolation du plancher bas",
    ],
    F: [
      "Isolation des combles",
      "Remplacement des fenêtres",
      "Installation d'une chaudière à condensation ou pompe à chaleur",
      "Isolation des murs",
    ],
    E: [
      "Isolation des combles",
      "Remplacement du système de chauffage",
      "Installation de panneaux solaires thermiques",
    ],
    D: [
      "Optimisation du système de chauffage",
      "Installation de panneaux photovoltaïques",
    ],
  };

  const currentClassUpper = currentClass?.toUpperCase();

  if (!improvements[currentClassUpper]) {
    return [];
  }

  return improvements[currentClassUpper];
}

/**
 * Estime le coût des travaux pour améliorer le DPE
 */
export function estimateRenovationCost(
  currentClass: string,
  targetClass: string,
  surfaceM2: number
): { min: number; max: number; description: string } {
  // Coûts indicatifs par m² selon le saut de classe
  const costPerM2: Record<string, { min: number; max: number }> = {
    "G_to_E": { min: 400, max: 700 },
    "G_to_D": { min: 600, max: 1000 },
    "G_to_C": { min: 800, max: 1400 },
    "F_to_D": { min: 300, max: 600 },
    "F_to_C": { min: 500, max: 900 },
    "E_to_D": { min: 200, max: 400 },
    "E_to_C": { min: 400, max: 700 },
    "D_to_C": { min: 150, max: 300 },
  };

  const key = `${currentClass?.toUpperCase()}_to_${targetClass?.toUpperCase()}`;
  const costs = costPerM2[key];

  if (!costs) {
    return {
      min: 0,
      max: 0,
      description: "Estimation non disponible pour cette combinaison de classes",
    };
  }

  return {
    min: Math.round(costs.min * surfaceM2),
    max: Math.round(costs.max * surfaceM2),
    description: `Estimation pour passer de la classe ${currentClass} à ${targetClass} (${surfaceM2} m²)`,
  };
}
