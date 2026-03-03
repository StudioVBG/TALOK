/**
 * Constantes partagées pour les entités juridiques
 * Labels d'affichage et icônes par type d'entité.
 */

import type { LucideIcon } from "lucide-react";
import { Building2, User, Users, ArrowUpDown, Briefcase, Heart } from "lucide-react";

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  particulier: "Personnel",
  sci_ir: "SCI · IR",
  sci_is: "SCI · IS",
  sci_construction_vente: "SCCV",
  sarl: "SARL",
  sarl_famille: "SARL de famille",
  eurl: "EURL",
  sas: "SAS",
  sasu: "SASU",
  sa: "SA",
  snc: "SNC",
  indivision: "Indivision",
  demembrement_usufruit: "Usufruit",
  demembrement_nue_propriete: "Nue-propriété",
  holding: "Holding",
  micro_entrepreneur: "Micro-entrepreneur",
  association: "Association",
};

/** Labels courts (ex: sélecteur, badges compacts) */
export const ENTITY_TYPE_LABELS_SHORT: Record<string, string> = {
  particulier: "Personnel",
  sci_ir: "SCI IR",
  sci_is: "SCI IS",
  sci_construction_vente: "SCCV",
  sarl: "SARL",
  sarl_famille: "SARL fam.",
  eurl: "EURL",
  sas: "SAS",
  sasu: "SASU",
  sa: "SA",
  snc: "SNC",
  indivision: "Indivision",
  demembrement_usufruit: "Usufruit",
  demembrement_nue_propriete: "Nue-prop.",
  holding: "Holding",
  micro_entrepreneur: "Micro-entr.",
  association: "Association",
};

export function getEntityTypeLabel(entityType: string, short = false): string {
  const map = short ? ENTITY_TYPE_LABELS_SHORT : ENTITY_TYPE_LABELS;
  return map[entityType] ?? entityType;
}

export function getEntityIcon(entityType: string): LucideIcon {
  switch (entityType) {
    case "particulier":
      return User;
    case "micro_entrepreneur":
      return Briefcase;
    case "indivision":
      return Users;
    case "association":
      return Heart;
    case "demembrement_usufruit":
    case "demembrement_nue_propriete":
      return ArrowUpDown;
    default:
      return Building2;
  }
}
