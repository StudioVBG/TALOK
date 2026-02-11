/**
 * SOTA 2026 — State Machine centralisée du bail
 *
 * Service unique de vérité pour toutes les transitions d'état du bail.
 * Chaque transition a :
 *   - un guard (condition booléenne)
 *   - des side effects (audit, outbox, notifications)
 *   - une validation contextuelle
 *
 * Aucune mise à jour de `leases.statut` ne doit se faire en dehors de ce service.
 *
 * @see docs/audit-lease-workflow.md §3 — Matrice des états du bail
 */

import { type SupabaseClient } from "@supabase/supabase-js";
import { LEASE_STATUS, type LeaseStatus } from "@/lib/constants/roles";

// ============================================
// TYPES
// ============================================

export interface LeaseContext {
  leaseId: string;
  currentStatus: LeaseStatus;
  propertyId: string;
  ownerId: string;
  signersCount: number;
  ownerSignerExists: boolean;
  tenantSignerExists: boolean;
  allSignersSigned: boolean;
  edlEntreeExists: boolean;
  edlEntreeSigned: boolean;
  keysHandedOver: boolean;
  insuranceValid: boolean;
  dateDebutReached: boolean;
  noticeExists: boolean;
  noticePeriodCompleted: boolean;
  edlSortieExists: boolean;
  edlSortieSigned: boolean;
  depositSettled: boolean;
}

export type LeaseTransitionName =
  | "INITIATE_SIGNATURE"
  | "RECORD_SIGNATURE"
  | "MARK_FULLY_SIGNED"
  | "ACTIVATE"
  | "GIVE_NOTICE"
  | "TERMINATE"
  | "ARCHIVE"
  | "CANCEL";

export interface TransitionResult {
  success: boolean;
  previousStatus: string;
  newStatus: string;
  errors: string[];
  warnings: string[];
}

interface TransitionDef {
  from: LeaseStatus[];
  to: LeaseStatus;
  guard: (ctx: LeaseContext) => { allowed: boolean; errors: string[]; warnings: string[] };
}

// ============================================
// TRANSITION DEFINITIONS
// ============================================

const TRANSITIONS: Record<LeaseTransitionName, TransitionDef> = {
  INITIATE_SIGNATURE: {
    from: [LEASE_STATUS.DRAFT as LeaseStatus],
    to: LEASE_STATUS.PENDING_SIGNATURE as LeaseStatus,
    guard: (ctx) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      if (!ctx.ownerSignerExists) errors.push("Au moins un signataire propriétaire est requis");
      if (!ctx.tenantSignerExists) errors.push("Au moins un signataire locataire est requis");
      if (ctx.signersCount < 2) errors.push("Au moins 2 signataires sont requis");
      return { allowed: errors.length === 0, errors, warnings };
    },
  },

  RECORD_SIGNATURE: {
    from: [LEASE_STATUS.PENDING_SIGNATURE as LeaseStatus],
    to: LEASE_STATUS.PENDING_SIGNATURE as LeaseStatus, // reste dans le même état
    guard: (_ctx) => ({ allowed: true, errors: [], warnings: [] }),
  },

  MARK_FULLY_SIGNED: {
    from: [LEASE_STATUS.PENDING_SIGNATURE as LeaseStatus],
    to: LEASE_STATUS.FULLY_SIGNED as LeaseStatus,
    guard: (ctx) => {
      const errors: string[] = [];
      if (!ctx.allSignersSigned) errors.push("Tous les signataires n'ont pas encore signé");
      if (!ctx.ownerSignerExists) errors.push("Le signataire propriétaire est manquant");
      if (!ctx.tenantSignerExists) errors.push("Le signataire locataire est manquant");
      return { allowed: errors.length === 0, errors, warnings: [] };
    },
  },

  ACTIVATE: {
    from: [LEASE_STATUS.FULLY_SIGNED as LeaseStatus],
    to: LEASE_STATUS.ACTIVE as LeaseStatus,
    guard: (ctx) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!ctx.edlEntreeExists) {
        warnings.push("Aucun EDL d'entrée n'existe (peut être forcé)");
      } else if (!ctx.edlEntreeSigned) {
        warnings.push("L'EDL d'entrée n'est pas signé (peut être forcé)");
      }

      if (!ctx.keysHandedOver) {
        warnings.push("La remise des clés n'a pas été confirmée");
      }

      if (!ctx.insuranceValid) {
        warnings.push("L'assurance habitation du locataire n'est pas vérifiée");
      }

      if (!ctx.dateDebutReached) {
        warnings.push("La date de début du bail n'est pas encore atteinte");
      }

      // Pas de blocage dur — les warnings sont des recommandations
      // L'activation peut être forcée
      return { allowed: true, errors, warnings };
    },
  },

  GIVE_NOTICE: {
    from: [LEASE_STATUS.ACTIVE as LeaseStatus],
    to: "notice_given" as LeaseStatus,
    guard: (ctx) => {
      const errors: string[] = [];
      if (!ctx.noticeExists) errors.push("Aucun congé/préavis n'a été enregistré");
      return { allowed: errors.length === 0, errors, warnings: [] };
    },
  },

  TERMINATE: {
    from: [
      LEASE_STATUS.ACTIVE as LeaseStatus,
      "notice_given" as LeaseStatus,
    ],
    to: LEASE_STATUS.TERMINATED as LeaseStatus,
    guard: (_ctx) => {
      // La terminaison est toujours possible depuis active ou notice_given
      return { allowed: true, errors: [], warnings: [] };
    },
  },

  ARCHIVE: {
    from: [LEASE_STATUS.TERMINATED as LeaseStatus],
    to: LEASE_STATUS.ARCHIVED as LeaseStatus,
    guard: (_ctx) => ({ allowed: true, errors: [], warnings: [] }),
  },

  CANCEL: {
    from: [
      LEASE_STATUS.DRAFT as LeaseStatus,
      LEASE_STATUS.PENDING_SIGNATURE as LeaseStatus,
    ],
    to: LEASE_STATUS.CANCELLED as LeaseStatus,
    guard: (_ctx) => ({ allowed: true, errors: [], warnings: [] }),
  },
};

// ============================================
// SERVICE
// ============================================

export class LeaseStateMachineService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Construit le contexte complet du bail pour évaluer les guards.
   */
  async buildContext(leaseId: string): Promise<LeaseContext | null> {
    // 1. Récupérer le bail
    const { data: lease } = await this.supabase
      .from("leases")
      .select("id, statut, property_id, date_debut")
      .eq("id", leaseId)
      .single();

    if (!lease) return null;

    // 2. Récupérer l'owner via la propriété
    const { data: property } = await this.supabase
      .from("properties")
      .select("owner_id")
      .eq("id", lease.property_id)
      .single();

    // 3. Récupérer les signataires
    const { data: signers } = await this.supabase
      .from("lease_signers")
      .select("id, role, signature_status, profile_id")
      .eq("lease_id", leaseId);

    const signersList = signers || [];
    const ownerRoles = ["proprietaire", "owner", "bailleur"];
    const tenantRoles = ["locataire_principal", "locataire", "tenant", "principal", "colocataire"];

    const ownerSignerExists = signersList.some((s: any) => ownerRoles.includes((s.role || "").toLowerCase()));
    const tenantSignerExists = signersList.some((s: any) => tenantRoles.includes((s.role || "").toLowerCase()));
    const allSignersSigned = signersList.length >= 2
      && signersList.every((s: any) => s.signature_status === "signed")
      && signersList.every((s: any) => s.profile_id != null);

    // 4. Vérifier l'EDL d'entrée
    const { data: edlEntree } = await this.supabase
      .from("edl")
      .select("id, status")
      .eq("lease_id", leaseId)
      .eq("type", "entree")
      .maybeSingle();

    // 5. Vérifier la remise des clés
    const { data: keyHandover } = await this.supabase
      .from("key_handovers")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("status", "completed")
      .maybeSingle();

    // 6. Vérifier l'assurance
    const tenantSigner = signersList.find((s: any) => tenantRoles.includes((s.role || "").toLowerCase()));
    let insuranceValid = false;
    if (tenantSigner?.profile_id) {
      const { data: insurance } = await this.supabase
        .from("insurance_policies")
        .select("id, end_date")
        .eq("tenant_profile_id", tenantSigner.profile_id)
        .gte("end_date", new Date().toISOString().split("T")[0])
        .maybeSingle();
      insuranceValid = !!insurance;
    }

    // 7. Vérifier le congé
    const { data: notice } = await this.supabase
      .from("lease_notices")
      .select("id, effective_end_date, status")
      .eq("lease_id", leaseId)
      .in("status", ["pending", "acknowledged"])
      .maybeSingle();

    const noticePeriodCompleted = notice
      ? new Date(notice.effective_end_date) <= new Date()
      : false;

    // 8. Vérifier l'EDL de sortie
    const { data: edlSortie } = await this.supabase
      .from("edl")
      .select("id, status")
      .eq("lease_id", leaseId)
      .eq("type", "sortie")
      .maybeSingle();

    // 9. Date de début
    const dateDebutReached = new Date(lease.date_debut) <= new Date();

    return {
      leaseId,
      currentStatus: lease.statut as LeaseStatus,
      propertyId: lease.property_id,
      ownerId: property?.owner_id || "",
      signersCount: signersList.length,
      ownerSignerExists,
      tenantSignerExists,
      allSignersSigned,
      edlEntreeExists: !!edlEntree,
      edlEntreeSigned: edlEntree?.status === "signed",
      keysHandedOver: !!keyHandover,
      insuranceValid,
      dateDebutReached,
      noticeExists: !!notice,
      noticePeriodCompleted,
      edlSortieExists: !!edlSortie,
      edlSortieSigned: edlSortie?.status === "signed",
      depositSettled: false, // calculé séparément si nécessaire
    };
  }

  /**
   * Vérifie si une transition est possible sans l'exécuter.
   */
  canTransition(
    transitionName: LeaseTransitionName,
    context: LeaseContext
  ): { allowed: boolean; errors: string[]; warnings: string[] } {
    const def = TRANSITIONS[transitionName];
    if (!def) {
      return { allowed: false, errors: [`Transition inconnue : ${transitionName}`], warnings: [] };
    }

    // Vérifier l'état source
    if (!def.from.includes(context.currentStatus)) {
      return {
        allowed: false,
        errors: [
          `Transition "${transitionName}" impossible depuis l'état "${context.currentStatus}". ` +
          `États source valides : ${def.from.join(", ")}`,
        ],
        warnings: [],
      };
    }

    // Évaluer le guard
    return def.guard(context);
  }

  /**
   * Exécute une transition d'état avec tous les side effects.
   */
  async executeTransition(
    leaseId: string,
    transitionName: LeaseTransitionName,
    actorUserId: string,
    options: { force?: boolean; metadata?: Record<string, unknown> } = {}
  ): Promise<TransitionResult> {
    const context = await this.buildContext(leaseId);
    if (!context) {
      return {
        success: false,
        previousStatus: "unknown",
        newStatus: "unknown",
        errors: ["Bail non trouvé"],
        warnings: [],
      };
    }

    const def = TRANSITIONS[transitionName];
    if (!def) {
      return {
        success: false,
        previousStatus: context.currentStatus,
        newStatus: context.currentStatus,
        errors: [`Transition inconnue : ${transitionName}`],
        warnings: [],
      };
    }

    // Vérifier la transition
    const check = this.canTransition(transitionName, context);

    if (!check.allowed && !options.force) {
      return {
        success: false,
        previousStatus: context.currentStatus,
        newStatus: context.currentStatus,
        errors: check.errors,
        warnings: check.warnings,
      };
    }

    // Si c'est une self-transition (RECORD_SIGNATURE), pas de changement de statut
    const newStatus = def.to;
    const isSelfTransition = context.currentStatus === newStatus;

    // Mettre à jour le statut en base
    if (!isSelfTransition) {
      const updateData: Record<string, unknown> = {
        statut: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (transitionName === "ACTIVATE") {
        updateData.activated_at = new Date().toISOString();
      }

      const { error: updateError } = await this.supabase
        .from("leases")
        .update(updateData)
        .eq("id", leaseId);

      if (updateError) {
        return {
          success: false,
          previousStatus: context.currentStatus,
          newStatus: context.currentStatus,
          errors: [`Erreur mise à jour : ${updateError.message}`],
          warnings: [],
        };
      }
    }

    // Side effects : audit log
    await this.supabase
      .from("audit_log")
      .insert({
        user_id: actorUserId,
        action: `lease_transition_${transitionName.toLowerCase()}`,
        entity_type: "lease",
        entity_id: leaseId,
        metadata: {
          previous_status: context.currentStatus,
          new_status: newStatus,
          transition: transitionName,
          forced: options.force || false,
          warnings: check.warnings,
          ...options.metadata,
        },
      } as any)
      .then(() => {})
      .catch((err: unknown) => console.warn("[LeaseStateMachine] Audit error:", err));

    // Side effects : outbox event
    const eventType = this.getEventType(transitionName);
    if (eventType) {
      await this.supabase
        .from("outbox")
        .insert({
          event_type: eventType,
          payload: {
            lease_id: leaseId,
            previous_status: context.currentStatus,
            new_status: newStatus,
            actor_user_id: actorUserId,
            forced: options.force || false,
          },
        } as any)
        .then(() => {})
        .catch((err: unknown) => console.warn("[LeaseStateMachine] Outbox error:", err));
    }

    return {
      success: true,
      previousStatus: context.currentStatus,
      newStatus,
      errors: options.force ? check.errors : [],
      warnings: check.warnings,
    };
  }

  /**
   * Retourne toutes les transitions possibles depuis l'état actuel.
   */
  getAvailableTransitions(context: LeaseContext): Array<{
    name: LeaseTransitionName;
    targetStatus: LeaseStatus;
    allowed: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result: Array<{
      name: LeaseTransitionName;
      targetStatus: LeaseStatus;
      allowed: boolean;
      errors: string[];
      warnings: string[];
    }> = [];

    for (const [name, def] of Object.entries(TRANSITIONS)) {
      if (def.from.includes(context.currentStatus)) {
        const check = def.guard(context);
        result.push({
          name: name as LeaseTransitionName,
          targetStatus: def.to,
          allowed: check.allowed,
          errors: check.errors,
          warnings: check.warnings,
        });
      }
    }

    return result;
  }

  private getEventType(transition: LeaseTransitionName): string | null {
    const map: Partial<Record<LeaseTransitionName, string>> = {
      INITIATE_SIGNATURE: "Lease.SentForSignature",
      MARK_FULLY_SIGNED: "Lease.FullySigned",
      ACTIVATE: "Lease.Activated",
      GIVE_NOTICE: "Lease.NoticeGiven",
      TERMINATE: "Lease.Terminated",
      CANCEL: "Lease.Cancelled",
    };
    return map[transition] || null;
  }
}

// ============================================
// FACTORY
// ============================================

/**
 * Crée une instance du service state machine.
 * Utiliser getServiceClient() pour les opérations serveur.
 */
export function createLeaseStateMachine(supabase: SupabaseClient): LeaseStateMachineService {
  return new LeaseStateMachineService(supabase);
}
