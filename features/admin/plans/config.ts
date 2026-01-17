/**
 * Configuration constants for Admin Plans
 * Extracted from app/admin/plans/page.tsx
 */

import {
  FileText,
  Euro,
  Home,
  Users,
  Building2,
  Key,
  Headphones,
  Brain,
} from "lucide-react";
import type { FeatureGroup, PlanColorScheme } from "./types";

export const PLAN_COLORS: Record<string, PlanColorScheme> = {
  solo: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-600 dark:text-slate-400",
    gradient: "from-slate-500/20 to-slate-600/5",
    ring: "ring-slate-500/50",
  },
  confort: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
    gradient: "from-blue-500/20 to-blue-600/5",
    ring: "ring-blue-500/50",
  },
  pro: {
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    text: "text-violet-600 dark:text-violet-400",
    gradient: "from-violet-500/20 to-violet-600/5",
    ring: "ring-violet-500/50",
  },
  enterprise: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    gradient: "from-amber-500/20 to-amber-600/5",
    ring: "ring-amber-500/50",
  },
};

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "documents",
    label: "Documents & Signatures",
    icon: FileText,
    features: [
      { key: "signatures", label: "E-signature Yousign", type: "boolean" },
      { key: "signatures_monthly_quota", label: "Signatures/mois", type: "number", unlimited: -1 },
      { key: "lease_generation", label: "Génération auto baux", type: "boolean" },
      { key: "lease_templates", label: "Modèles de baux", type: "level", levels: ["basic", "full", "custom"] },
      { key: "edl_digital", label: "EDL numériques", type: "boolean" },
      { key: "attestations", label: "Attestations", type: "boolean" },
      { key: "ocr_documents", label: "OCR Mindee", type: "boolean" },
      { key: "storage_gb", label: "Stockage (Go)", type: "number", unlimited: -1 },
      { key: "email_templates", label: "Modèles emails", type: "boolean" },
    ],
  },
  {
    id: "finances",
    label: "Loyers & Finances",
    icon: Euro,
    features: [
      { key: "open_banking_level", label: "Open Banking", type: "level", levels: ["none", "basic", "advanced", "premium"] },
      { key: "bank_reconciliation", label: "Rapprochement bancaire", type: "boolean" },
      { key: "auto_reminders", label: "Relances email", type: "boolean" },
      { key: "auto_reminders_sms", label: "Relances SMS", type: "boolean" },
      { key: "irl_revision", label: "Révision IRL auto", type: "boolean" },
      { key: "alerts_deadlines", label: "Alertes échéances", type: "boolean" },
      { key: "deposit_tracking", label: "Suivi dépôts garantie", type: "boolean" },
      { key: "tenant_payment_online", label: "Paiement en ligne", type: "boolean" },
      { key: "export_csv", label: "Export CSV", type: "boolean" },
      { key: "export_excel", label: "Export Excel", type: "boolean" },
      { key: "export_accounting", label: "Export comptable FEC", type: "boolean" },
    ],
  },
  {
    id: "properties",
    label: "Biens & Baux",
    icon: Home,
    features: [
      { key: "tenant_portal", label: "Portail locataire", type: "level", levels: ["none", "basic", "advanced", "whitelabel"] },
      { key: "colocation", label: "Gestion colocation", type: "boolean" },
      { key: "multi_units", label: "Unités multiples", type: "boolean" },
    ],
  },
  {
    id: "collaboration",
    label: "Collaboration",
    icon: Users,
    features: [
      { key: "multi_users", label: "Multi-utilisateurs", type: "boolean" },
      { key: "max_users", label: "Utilisateurs max", type: "number", unlimited: -1 },
      { key: "roles_permissions", label: "Rôles & permissions", type: "boolean" },
      { key: "activity_log", label: "Journal d'audit", type: "boolean" },
      { key: "multi_mandants", label: "Multi-mandants", type: "boolean" },
      { key: "owner_reports", label: "Rapports propriétaires", type: "boolean" },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Building2,
    features: [
      { key: "work_orders", label: "Tickets maintenance", type: "boolean" },
      { key: "work_orders_planning", label: "Planning interventions", type: "boolean" },
      { key: "providers_management", label: "Gestion prestataires", type: "boolean" },
    ],
  },
  {
    id: "integrations",
    label: "Intégrations",
    icon: Key,
    features: [
      { key: "channel_manager", label: "Channel manager", type: "level", levels: ["none", "basic", "full"] },
      { key: "api_access_level", label: "Accès API", type: "level", levels: ["none", "basic", "full"] },
      { key: "webhooks", label: "Webhooks", type: "boolean" },
      { key: "white_label", label: "White label", type: "boolean" },
      { key: "sso", label: "SSO SAML/OAuth", type: "boolean" },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: Headphones,
    features: [
      { key: "priority_support", label: "Support prioritaire", type: "boolean" },
      { key: "support_phone", label: "Support téléphone", type: "boolean" },
      { key: "onboarding", label: "Onboarding personnalisé", type: "boolean" },
      { key: "data_import", label: "Import données", type: "boolean" },
      { key: "custom_sla", label: "SLA contractuel", type: "boolean" },
      { key: "account_manager", label: "Account manager", type: "boolean" },
    ],
  },
  {
    id: "ia",
    label: "IA & Avancé",
    icon: Brain,
    features: [{ key: "scoring_ia", label: "Scoring IA locataire", type: "boolean" }],
  },
];

export const LEVEL_LABELS: Record<string, string> = {
  none: "Non",
  basic: "Basic",
  advanced: "Avancé",
  premium: "Premium",
  full: "Complet",
  whitelabel: "White label",
  custom: "Sur mesure",
};
