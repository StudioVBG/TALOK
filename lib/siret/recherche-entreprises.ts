import { isValidSiret, siretToSiren } from "@/lib/entities/siret-validation";
import { shortFormeJuridique } from "@/lib/siret/nature-juridique";
import { computeTvaIntra } from "@/lib/siret/tva";
import type { ResolvedLegalIdentity, SiretLookupResult } from "@/lib/siret/types";

/**
 * Service de résolution SIRET via l'API publique Recherche d'entreprises.
 *
 * Endpoint : https://recherche-entreprises.api.gouv.fr/search
 *   - Gratuit, sans authentification
 *   - Rate limit public : 7 req/sec
 *   - Doc : https://recherche-entreprises.api.gouv.fr/docs/
 *
 * On l'appelle UNE FOIS au signup de l'artisan, puis on stocke le résultat.
 * Les devis et factures liront ensuite la table `providers` directement —
 * pas de nouvel appel API à chaque émission.
 */

export const RECHERCHE_ENTREPRISES_URL = "https://recherche-entreprises.api.gouv.fr/search";

const API_TIMEOUT_MS = 5000;

interface ApiDirigeant {
  nom?: string | null;
  prenoms?: string | null;
  qualite?: string | null;
  type_dirigeant?: string | null;
}

interface ApiSiege {
  siret?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  libelle_commune?: string | null;
  activite_principale?: string | null;
  libelle_activite_principale?: string | null;
}

interface ApiComplements {
  est_rge?: boolean | null;
  est_entrepreneur_individuel?: boolean | null;
}

interface ApiResult {
  siren: string;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  nature_juridique?: string | null;
  libelle_nature_juridique?: string | null;
  etat_administratif?: string | null;
  date_creation?: string | null;
  capital_social?: number | string | null;
  siege?: ApiSiege | null;
  dirigeants?: ApiDirigeant[] | null;
  complements?: ApiComplements | null;
  matching_etablissements?: Array<{
    siret?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    libelle_commune?: string | null;
    activite_principale?: string | null;
    libelle_activite_principale?: string | null;
  }> | null;
}

interface ApiResponse {
  results?: ApiResult[];
  total_results?: number;
}

function pickEstablishment(
  result: ApiResult,
  siret: string,
): {
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  naf_code: string | null;
  naf_label: string | null;
} {
  // Préférer l'établissement qui matche le SIRET fourni (siège ou secondaire)
  const candidates = [...(result.matching_etablissements ?? []), result.siege ?? null].filter(
    (e): e is NonNullable<typeof e> => e != null,
  );

  const matched = candidates.find((e) => e.siret === siret) ?? candidates[0];

  return {
    adresse: matched?.adresse ?? null,
    code_postal: matched?.code_postal ?? null,
    ville: matched?.libelle_commune ?? null,
    naf_code: matched?.activite_principale ?? null,
    naf_label: matched?.libelle_activite_principale ?? null,
  };
}

function pickDirigeant(dirigeants: ApiDirigeant[] | null | undefined): {
  nom: string | null;
  prenom: string | null;
  qualite: string | null;
} {
  if (!dirigeants || dirigeants.length === 0) {
    return { nom: null, prenom: null, qualite: null };
  }
  // Le premier dirigeant listé est généralement le représentant principal
  const d = dirigeants[0];
  return {
    nom: d.nom ?? null,
    prenom: d.prenoms ?? null,
    qualite: d.qualite ?? d.type_dirigeant ?? null,
  };
}

function parseRcs(rawRcs: string | null | undefined): { numero: string | null; ville: string | null } {
  // L'API ne renvoie pas le RCS de façon structurée. On laisse vide pour
  // saisie manuelle — l'utilisateur connaît sa ville d'immatriculation.
  // (Le SIREN tient lieu d'identifiant RCS unique en pratique.)
  return { numero: rawRcs ?? null, ville: null };
}

/**
 * Résout un SIRET via l'API gouv.
 *
 * @param siret - 14 chiffres (avec ou sans espaces)
 * @returns SiretLookupResult — succès avec les données enrichies,
 *   ou échec typé (invalid_siret | not_found | ceased | api_unavailable).
 */
export async function lookupBySiret(siret: string): Promise<SiretLookupResult> {
  const cleanSiret = siret.replace(/\s/g, "");

  if (!isValidSiret(cleanSiret)) {
    return {
      ok: false,
      reason: "invalid_siret",
      message: "Le SIRET fourni n'est pas valide (clé de contrôle Luhn).",
    };
  }

  const siren = siretToSiren(cleanSiret);
  if (!siren) {
    return {
      ok: false,
      reason: "invalid_siret",
      message: "Impossible d'extraire le SIREN du SIRET.",
    };
  }

  const url = `${RECHERCHE_ENTREPRISES_URL}?q=${encodeURIComponent(cleanSiret)}&page=1&per_page=1`;

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
  } catch (err) {
    return {
      ok: false,
      reason: "api_unavailable",
      message:
        err instanceof Error && err.name === "AbortError"
          ? "L'API n'a pas répondu à temps. Réessayez dans un instant."
          : "L'API Recherche d'entreprises est momentanément indisponible.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "api_unavailable",
      message: `L'API a renvoyé un statut ${response.status}.`,
    };
  }

  let payload: ApiResponse;
  try {
    payload = (await response.json()) as ApiResponse;
  } catch {
    return {
      ok: false,
      reason: "api_unavailable",
      message: "Réponse API invalide.",
    };
  }

  const result = payload.results?.[0];
  if (!result || result.siren !== siren) {
    return {
      ok: false,
      reason: "not_found",
      message: "Aucune entreprise trouvée pour ce SIRET.",
    };
  }

  const etat = result.etat_administratif === "C" ? "C" : "A";
  if (etat === "C") {
    return {
      ok: false,
      reason: "ceased",
      message:
        "Cette entreprise est marquée comme cessée auprès de l'INSEE. Vérifiez votre SIRET ou contactez le support.",
    };
  }

  const establishment = pickEstablishment(result, cleanSiret);
  const dirigeant = pickDirigeant(result.dirigeants);
  const rcs = parseRcs(null);

  const capitalRaw = result.capital_social;
  const capital_social =
    typeof capitalRaw === "number"
      ? capitalRaw
      : typeof capitalRaw === "string" && capitalRaw.trim() !== ""
        ? Number(capitalRaw)
        : null;

  const data: ResolvedLegalIdentity = {
    siret: cleanSiret,
    siren,
    raison_sociale: result.nom_raison_sociale ?? result.nom_complet ?? "",
    forme_juridique: shortFormeJuridique(result.nature_juridique, result.libelle_nature_juridique),
    nature_juridique_code: result.nature_juridique ?? null,
    capital_social: Number.isFinite(capital_social) ? capital_social : null,
    date_creation: result.date_creation ?? null,
    rcs_numero: rcs.numero,
    rcs_ville: rcs.ville,
    tva_intra: computeTvaIntra(siren),
    naf_code: establishment.naf_code,
    naf_label: establishment.naf_label,
    adresse: establishment.adresse,
    code_postal: establishment.code_postal,
    ville: establishment.ville,
    dirigeant_nom: dirigeant.nom,
    dirigeant_prenom: dirigeant.prenom,
    dirigeant_qualite: dirigeant.qualite,
    est_rge: result.complements?.est_rge === true,
    etat_administratif: etat,
  };

  return { ok: true, data };
}
