"use client";

/**
 * CoproGate - Wrapper de gating pour le module copropriété
 *
 * SOTA 2026 : feature `copro_module` vérifiée dynamiquement via
 * PlanGate → hasPlanFeature() → lib/subscriptions/plans.ts.
 * La matrice par plan (Gratuit/Starter/Confort/Pro/Enterprise) est définie
 * dans `lib/subscriptions/plans.ts` — source unique de vérité. Ne pas
 * hardcoder de nom de plan dans ce fichier, le gating est déterminé
 * dynamiquement au runtime selon le flag du plan actif de l'utilisateur.
 */

import { ReactNode } from "react";
import { PlanGate } from "@/components/subscription";

interface CoproGateProps {
  children: ReactNode;
}

export function CoproGate({ children }: CoproGateProps) {
  return (
    <PlanGate feature="copro_module" mode="blur">
      {children}
    </PlanGate>
  );
}
