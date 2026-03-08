import { useMemo } from "react";
import {
  PenTool,
  CreditCard,
  FileText,
  Shield,
  FileCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";
import type { LucideIcon } from "lucide-react";

export interface PendingAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  href: string;
  priority: number; // lower = higher priority
}

interface UsePendingActionsOptions {
  dashboard: any;
  hasSignedLease: boolean;
  pendingEDLs: any[];
}

/**
 * SOTA 2026: Source unique pour les actions en attente du locataire.
 * Utilisé par Dashboard (Command Center) et Documents (Zone "À faire").
 * Évite la duplication de logique entre les deux pages.
 */
export function useTenantPendingActions({
  dashboard,
  hasSignedLease,
  pendingEDLs,
}: UsePendingActionsOptions): PendingAction[] {
  return useMemo(() => {
    if (!dashboard) return [];
    const actions: PendingAction[] = [];

    // Action 1 : Signer le bail (Priorité Haute)
    const leaseStatus = dashboard.lease?.statut;
    const needsToSignLease =
      (leaseStatus === "pending_signature" || leaseStatus === "partially_signed") &&
      !hasSignedLease;

    if (needsToSignLease) {
      actions.push({
        id: "sign-lease",
        label: "Signer mon bail",
        description: "Votre bail est prêt et attend votre signature.",
        icon: PenTool,
        color: "text-indigo-700",
        bgColor: "bg-indigo-50 border-indigo-200",
        href: "/tenant/onboarding/sign",
        priority: 1,
      });
    }

    // Action 2 : Impayés
    if (dashboard.stats?.unpaid_amount > 0) {
      actions.push({
        id: "payment",
        label: `Régulariser ${formatCurrency(dashboard.stats.unpaid_amount)}`,
        description: "Vous avez un ou plusieurs loyers en attente de paiement.",
        icon: CreditCard,
        color: "text-red-700",
        bgColor: "bg-red-50 border-red-200",
        href: "/tenant/payments",
        priority: 2,
      });
    }

    // Action 3 : EDL en attente
    if (pendingEDLs.length > 0) {
      actions.push({
        id: "sign-edl",
        label: "Signer l'état des lieux",
        description: "Un état des lieux est en attente de votre signature.",
        icon: FileCheck,
        color: "text-amber-700",
        bgColor: "bg-amber-50 border-amber-200",
        href: `/signature-edl/${pendingEDLs[0].invitation_token}`,
        priority: 3,
      });
    }

    // Action 4 : Assurance manquante
    if (!dashboard.insurance?.has_insurance) {
      actions.push({
        id: "upload-insurance",
        label: "Déposer l'attestation d'assurance",
        description: "Obligatoire pour activer votre bail.",
        icon: Shield,
        color: "text-blue-700",
        bgColor: "bg-blue-50 border-blue-200",
        href: "/tenant/documents?action=upload&type=attestation_assurance",
        priority: 4,
      });
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }, [dashboard, hasSignedLease, pendingEDLs]);
}
