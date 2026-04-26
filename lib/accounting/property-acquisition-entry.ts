/**
 * Bridge acquisition d'un bien immobilier → moteur double-entrée.
 *
 * Quand un propriétaire renseigne l'achat d'un bien (prix, financement,
 * date), on pose une écriture composée qui :
 *   1. Débite chaque compte d'immobilisation (classe 2) pour la quote-part
 *      du composant (terrain, gros oeuvre, façade, installations,
 *      agencements, équipements) — décomposition standard PCG bailleur.
 *   2. Crédite l'emprunt (164000) pour la portion empruntée.
 *   3. Crédite la banque (512100) pour la portion en apport.
 *
 * Permet ensuite à l'amortissement automatique (681100 / 281xxx) de
 * fonctionner correctement, et au bilan d'être complet.
 *
 * Idempotent via `reference = property.id` + source 'auto:property_acquisition'.
 *
 * Mapping composant → compte d'immobilisation :
 *   terrain                  → 211000
 *   gros_oeuvre              → 213100
 *   facade                   → 213200
 *   installations_generales  → 213300
 *   agencements              → 214100
 *   equipements              → 215100
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createEntry } from "@/lib/accounting/engine";
import {
  decomposeProperty,
  type PropertyComponent,
} from "@/lib/accounting/chart-amort-ocr";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";
import {
  getEntityAccountingConfig,
  markEntryInformational,
  shouldMarkInformational,
} from "@/lib/accounting/entity-config";
import { resolveSystemActorForEntity } from "@/lib/accounting/system-actor";

export type PropertyAcquisitionSkipReason =
  | "already_exists"
  | "property_not_found"
  | "entity_not_resolved"
  | "accounting_disabled"
  | "exercise_not_available"
  | "amount_invalid"
  | "actor_unresolved"
  | "error";

export interface PropertyAcquisitionEntryResult {
  created: boolean;
  skippedReason?: PropertyAcquisitionSkipReason;
  entryId?: string;
  /** Composants calculés avec leurs montants en cents — utile pour l'UI. */
  components?: PropertyComponent[];
  error?: string;
}

export interface PropertyAcquisitionParams {
  /** ID du bien immobilier acquis. */
  propertyId: string;
  /** Prix d'acquisition total en centimes (frais notariaux inclus si souhaité). */
  totalCents: number;
  /** Portion empruntée en centimes (le reste = apport via 512100). */
  loanCents: number;
  /** Date d'acquisition (YYYY-MM-DD). */
  acquisitionDate: string;
  /** Pourcentage du terrain (non amortissable), 15% par défaut. */
  terrainPct?: number;
  /** Compte bancaire d'apport (défaut : 512100). */
  bankAccount?: string;
  /** Compte d'emprunt (défaut : 164000). */
  loanAccount?: string;
  userId?: string;
}

/** Mapping composant standard → compte d'immobilisation PCG. */
const COMPONENT_ACCOUNT: Record<string, string> = {
  terrain: "211000",
  gros_oeuvre: "213100",
  facade: "213200",
  installations_generales: "213300",
  agencements: "214100",
  equipements: "215100",
};

interface PropertyRow {
  id: string;
  legal_entity_id: string | null;
  adresse_complete: string | null;
}

async function findExistingEntry(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("accounting_entries")
    .select("id")
    .eq("reference", propertyId)
    .like("source", "auto:property_acquisition%")
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Pose l'écriture composée d'acquisition d'un bien. Idempotent via
 * `reference = property.id` — un même bien ne peut être comptabilisé
 * qu'une seule fois (l'écriture initiale est intangible une fois validée).
 *
 * Pour modifier après coup : utiliser engine.reverseEntry pour contre-passer,
 * puis appeler ce bridge à nouveau (la nouvelle écriture aura un entry_number
 * différent mais la même reference).
 */
export async function ensurePropertyAcquisitionEntry(
  supabase: SupabaseClient,
  params: PropertyAcquisitionParams,
): Promise<PropertyAcquisitionEntryResult> {
  try {
    if (!Number.isFinite(params.totalCents) || params.totalCents <= 0) {
      return { created: false, skippedReason: "amount_invalid" };
    }
    if (
      !Number.isFinite(params.loanCents) ||
      params.loanCents < 0 ||
      params.loanCents > params.totalCents
    ) {
      return { created: false, skippedReason: "amount_invalid" };
    }

    const existingId = await findExistingEntry(supabase, params.propertyId);
    if (existingId) {
      return {
        created: false,
        skippedReason: "already_exists",
        entryId: existingId,
      };
    }

    // Lookup property pour résoudre l'entité juridique propriétaire
    const { data: propertyData } = await supabase
      .from("properties")
      .select("id, legal_entity_id, adresse_complete")
      .eq("id", params.propertyId)
      .maybeSingle();

    const property = propertyData as unknown as PropertyRow | null;
    if (!property) {
      return { created: false, skippedReason: "property_not_found" };
    }

    const entityId = property.legal_entity_id;
    if (!entityId) {
      return { created: false, skippedReason: "entity_not_resolved" };
    }

    const config = await getEntityAccountingConfig(supabase, entityId);
    if (!config || !config.accountingEnabled) {
      return { created: false, skippedReason: "accounting_disabled" };
    }

    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    const actorUserId =
      params.userId ??
      (await resolveSystemActorForEntity(supabase, entityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "actor_unresolved" };
    }

    // Décomposition par composant (terrain + 5 composants amortissables)
    const components = decomposeProperty(params.totalCents, params.terrainPct);

    // Lignes débit : un compte par composant
    const debitLines = components
      .filter((c) => c.amountCents > 0)
      .map((c) => ({
        accountNumber: COMPONENT_ACCOUNT[c.component] ?? "218000",
        debitCents: c.amountCents,
        creditCents: 0,
        label: `${c.component.replace(/_/g, " ")} (${c.percent}%)`,
        propertyId: params.propertyId,
      }));

    // Lignes crédit : emprunt + apport selon split
    const creditLines: Array<{
      accountNumber: string;
      debitCents: number;
      creditCents: number;
      label?: string;
      propertyId?: string;
    }> = [];

    if (params.loanCents > 0) {
      creditLines.push({
        accountNumber: params.loanAccount ?? "164000",
        debitCents: 0,
        creditCents: params.loanCents,
        label: "Emprunt immobilier",
        propertyId: params.propertyId,
      });
    }

    const apportCents = params.totalCents - params.loanCents;
    if (apportCents > 0) {
      creditLines.push({
        accountNumber: params.bankAccount ?? "512100",
        debitCents: 0,
        creditCents: apportCents,
        label: "Apport",
        propertyId: params.propertyId,
      });
    }

    const propertySuffix = property.adresse_complete
      ? ` - ${property.adresse_complete}`
      : "";

    const entry = await createEntry(supabase, {
      entityId,
      exerciseId: exercise.id,
      journalCode: "OD",
      entryDate: params.acquisitionDate,
      label: `Acquisition immobilière${propertySuffix}`,
      source: "auto:property_acquisition",
      reference: params.propertyId,
      userId: actorUserId,
      lines: [...debitLines, ...creditLines],
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, entry.id);
    }

    return { created: true, entryId: entry.id, components };
  } catch (err) {
    console.error("[ensurePropertyAcquisitionEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
