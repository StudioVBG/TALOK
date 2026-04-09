"use client";

/**
 * SeasonalGate - Wrapper de gating pour les pages location saisonnière
 * Le channel_manager feature gate contrôle l'accès au module saisonnier
 */

import { ReactNode } from "react";
import { PlanGate } from "@/components/subscription";

interface SeasonalGateProps {
  children: ReactNode;
}

export function SeasonalGate({ children }: SeasonalGateProps) {
  return (
    <PlanGate feature="channel_manager" mode="blur">
      {children}
    </PlanGate>
  );
}
