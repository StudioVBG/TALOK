/**
 * Données légales d'une entreprise — partagées client/serveur.
 * Représentent ce que la plateforme stocke après résolution via
 * l'API Recherche d'entreprises.
 */
export interface ResolvedLegalIdentity {
  siret: string;
  siren: string;
  raison_sociale: string;
  forme_juridique: string | null;
  nature_juridique_code: string | null;
  capital_social: number | null;
  date_creation: string | null;
  rcs_numero: string | null;
  rcs_ville: string | null;
  tva_intra: string;
  naf_code: string | null;
  naf_label: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  dirigeant_nom: string | null;
  dirigeant_prenom: string | null;
  dirigeant_qualite: string | null;
  est_rge: boolean;
  etat_administratif: "A" | "C";
}

export type SiretLookupOk = {
  ok: true;
  data: ResolvedLegalIdentity;
};

export type SiretLookupErr = {
  ok: false;
  reason: "invalid_siret" | "not_found" | "ceased" | "api_unavailable";
  message: string;
};

export type SiretLookupResult = SiretLookupOk | SiretLookupErr;
