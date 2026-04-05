/**
 * Configuration visuelle des types de documents
 *
 * DÉRIVÉ de `lib/documents/constants.ts` (source unique de vérité).
 * Ne PAS hardcoder de types ici — ajouter dans constants.ts d'abord.
 */

import type { ElementType } from "react";
import {
  FileText,
  FileSignature,
  Receipt,
  Shield,
  FileCheck,
  User,
  KeyRound,
} from "lucide-react";
import { TYPE_TO_LABEL, TYPE_TO_CATEGORY, type DocumentType, type DocumentCategory } from "./constants";

// ── Styles par catégorie ──

interface CategoryStyle {
  icon: ElementType;
  color: string;
  bgColor: string;
  darkBgColor: string;
}

const CATEGORY_STYLES: Record<DocumentCategory, CategoryStyle> = {
  contrat:      { icon: FileSignature, color: "text-blue-600",    bgColor: "bg-blue-50",    darkBgColor: "dark:bg-blue-900/30" },
  identite:     { icon: User,          color: "text-purple-600",  bgColor: "bg-purple-50",  darkBgColor: "dark:bg-purple-900/30" },
  finance:      { icon: Receipt,       color: "text-emerald-600", bgColor: "bg-emerald-50", darkBgColor: "dark:bg-emerald-900/30" },
  assurance:    { icon: Shield,        color: "text-indigo-600",  bgColor: "bg-indigo-50",  darkBgColor: "dark:bg-indigo-900/30" },
  diagnostic:   { icon: FileText,      color: "text-amber-600",   bgColor: "bg-amber-50",   darkBgColor: "dark:bg-amber-900/30" },
  edl:          { icon: FileCheck,     color: "text-amber-600",   bgColor: "bg-amber-50",   darkBgColor: "dark:bg-amber-900/30" },
  candidature:  { icon: FileText,      color: "text-teal-600",    bgColor: "bg-teal-50",    darkBgColor: "dark:bg-teal-900/30" },
  garant:       { icon: Shield,        color: "text-violet-600",  bgColor: "bg-violet-50",  darkBgColor: "dark:bg-violet-900/30" },
  prestataire:  { icon: FileText,      color: "text-orange-600",  bgColor: "bg-orange-50",  darkBgColor: "dark:bg-orange-900/30" },
  copropriete:  { icon: FileText,      color: "text-sky-600",     bgColor: "bg-sky-50",     darkBgColor: "dark:bg-sky-900/30" },
  autre:        { icon: FileText,      color: "text-muted-foreground", bgColor: "bg-muted", darkBgColor: "dark:bg-muted" },
};

// ── Overrides par type spécifique (quand le style doit différer de la catégorie) ──

const TYPE_STYLE_OVERRIDES: Partial<Record<string, Partial<CategoryStyle>>> = {
  quittance:              { icon: Receipt,       color: "text-emerald-600", bgColor: "bg-emerald-50" },
  EDL_sortie:             { color: "text-orange-600", bgColor: "bg-orange-50" },
  erp:                    { color: "text-red-600",    bgColor: "bg-red-50" },
  attestation_remise_cles:{ icon: KeyRound,      color: "text-violet-600",  bgColor: "bg-violet-50" },
  dpe:                    { color: "text-green-600",  bgColor: "bg-green-50" },
  diagnostic_plomb:       { color: "text-yellow-600", bgColor: "bg-yellow-50" },
  diagnostic_electricite: { color: "text-cyan-600",   bgColor: "bg-cyan-50" },
};

// ── Config générée ──

export interface DocumentConfigEntry {
  label: string;
  icon: ElementType;
  color: string;
  bgColor: string;
}

function buildConfig(): Record<string, DocumentConfigEntry> {
  const config: Record<string, DocumentConfigEntry> = {};

  // Générer depuis constants.ts
  for (const [type, label] of Object.entries(TYPE_TO_LABEL)) {
    const category = TYPE_TO_CATEGORY[type as DocumentType] ?? "autre";
    const catStyle = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.autre;
    const override = TYPE_STYLE_OVERRIDES[type] ?? {};

    config[type] = {
      label,
      icon: override.icon ?? catStyle.icon,
      color: override.color ?? catStyle.color,
      bgColor: override.bgColor ?? catStyle.bgColor,
    };
  }

  // Aliases courants (types non-canoniques rencontrés dans la DB)
  config.bail_signe = { ...config.bail, label: "Bail signé" };
  config.lease = config.bail;
  config.contrat = config.bail;
  config.receipt = config.quittance;
  config.assurance = config.attestation_assurance;
  config.edl_entree = config.EDL_entree;
  config.edl_sortie = config.EDL_sortie;
  config.edl = config.EDL_entree;
  config.cni = config.piece_identite;
  config.crep = config.diagnostic_plomb;
  config.electricite = config.diagnostic_electricite;
  config.gaz = config.diagnostic_gaz;
  config.amiante = config.diagnostic_amiante;
  config.attestation_remise_cles = {
    label: "Attestation remise des clés",
    icon: KeyRound,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
  };

  // Fallback
  config.autre = {
    label: "Document",
    icon: FileText,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  };

  return config;
}

/**
 * Configuration visuelle de TOUS les types de documents.
 * Dérivée automatiquement de `lib/documents/constants.ts`.
 *
 * Usage : `DOCUMENT_CONFIG[type]?.label` ou `DOCUMENT_CONFIG[type]?.icon`
 */
export const DOCUMENT_CONFIG = buildConfig();

/**
 * Types pertinents pour le filtre locataire (sous-ensemble des DOCUMENT_TYPES)
 */
export const TENANT_FILTER_TYPES = [
  { value: "bail", label: "Baux" },
  { value: "quittance", label: "Quittances" },
  { value: "attestation_assurance", label: "Assurance" },
  { value: "EDL_entree", label: "EDL d'entrée" },
  { value: "EDL_sortie", label: "EDL de sortie" },
  { value: "dpe", label: "DPE" },
  { value: "erp", label: "État des risques" },
  { value: "piece_identite", label: "Pièce d'identité" },
  { value: "justificatif_revenus", label: "Justificatifs" },
] as const;
