"use client";

/**
 * UpgradeGate — Composant wrapper universel pour le gating par forfait
 *
 * Trois modes :
 * 1. LOCK : masque le contenu, affiche un overlay avec CTA upgrade
 * 2. LIMIT : affiche le contenu mais avec un bandeau d'avertissement proche de la limite
 * 3. HIDE : masque complètement l'élément du DOM (idéal pour les items de sidebar)
 *
 * Délègue à PlanGate (block/blur/hide) et UsageLimitBanner selon le mode.
 */

import React from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { UsageLimitBanner } from "@/components/subscription/usage-limit-banner";
import { useSubscription } from "@/components/subscription/subscription-provider";
import type { PlanLimits } from "@/lib/subscriptions/plan-limits";
import type { FeatureKey } from "@/lib/subscriptions/plans";

// Mapping des features PlanLimits vers FeatureKey (pour PlanGate)
const PLAN_LIMITS_TO_FEATURE_KEY: Partial<Record<keyof PlanLimits, FeatureKey>> = {
  hasRentCollection: 'tenant_payment_online',
  hasAccounting: 'bank_reconciliation',
  hasFECExport: 'bank_reconciliation',
  hasOpenBanking: 'open_banking',
  hasAutoReminders: 'auto_reminders',
  hasAutoRemindersSMS: 'auto_reminders_sms',
  hasIRLRevision: 'irl_revision',
  hasEdlDigital: 'edl_digital',
  hasScoringTenant: 'scoring_tenant',
  hasFiscalAI: 'scoring_advanced',
  hasAITalo: 'scoring_advanced',
  hasMultiEntity: 'multi_mandants',
  hasAPI: 'api_access',
  hasWorkOrders: 'work_orders',
  hasProvidersManagement: 'providers_management',
  hasMultiUsers: 'multi_users',
  hasCoproModule: 'copro_module',
  hasWhiteLabel: 'white_label',
  hasSSO: 'sso',
  hasPrioritySupport: 'priority_support',
};

// Mapping des features quantitatives vers les ressources de UsageLimitBanner
const QUANTITATIVE_FEATURES: Partial<Record<keyof PlanLimits, "properties" | "leases" | "users" | "signatures">> = {
  maxProperties: 'properties',
  maxLeases: 'leases',
  maxUsers: 'users',
  maxSignaturesPerMonth: 'signatures',
};

interface UpgradeGateProps {
  /** Feature à vérifier (clé de PlanLimits) */
  feature: keyof PlanLimits;
  /** Valeur actuelle (pour les limites quantitatives en mode limit) */
  currentValue?: number;
  /** Mode de gating */
  mode?: 'lock' | 'limit' | 'hide';
  /** Contenu protégé */
  children: React.ReactNode;
  /** Classe CSS additionnelle */
  className?: string;
}

export function UpgradeGate({
  feature,
  currentValue,
  mode = 'lock',
  children,
  className,
}: UpgradeGateProps) {
  // Mode "limit" pour les features quantitatives : affiche un bandeau d'avertissement
  const quantitativeResource = QUANTITATIVE_FEATURES[feature];
  if (mode === 'limit' && quantitativeResource) {
    return (
      <>
        <UsageLimitBanner resource={quantitativeResource} threshold={80} variant="inline" />
        {children}
      </>
    );
  }

  // Mapper vers la FeatureKey correspondante pour PlanGate
  const featureKey = PLAN_LIMITS_TO_FEATURE_KEY[feature];

  // Si on a un FeatureKey, utiliser PlanGate
  if (featureKey) {
    const planGateMode = mode === 'lock' ? 'block' : mode === 'hide' ? 'hide' : 'blur';
    return (
      <PlanGate feature={featureKey} mode={planGateMode} className={className}>
        {children}
      </PlanGate>
    );
  }

  // Fallback : pour les features quantitatives en mode lock/hide, vérifier manuellement
  if (quantitativeResource) {
    return (
      <QuantitativeGate
        resource={quantitativeResource}
        mode={mode}
        className={className}
      >
        {children}
      </QuantitativeGate>
    );
  }

  // Feature inconnue — afficher le contenu par défaut
  return <>{children}</>;
}

/**
 * Gate pour les limites quantitatives (properties, signatures, etc.)
 */
function QuantitativeGate({
  resource,
  mode,
  children,
  className,
}: {
  resource: "properties" | "leases" | "users" | "signatures";
  mode: 'lock' | 'limit' | 'hide';
  children: React.ReactNode;
  className?: string;
}) {
  const { canUseMore, loading } = useSubscription();

  if (loading) {
    return <>{children}</>;
  }

  const canAdd = canUseMore(resource);

  if (canAdd) {
    return <>{children}</>;
  }

  if (mode === 'hide') {
    return null;
  }

  // Lock mode : le contenu est rendu mais avec un overlay géré par le parent
  // Pour l'instant on affiche le bandeau d'avertissement
  return (
    <>
      <UsageLimitBanner resource={resource} threshold={0} variant="inline" dismissible={false} />
      {children}
    </>
  );
}

export default UpgradeGate;
