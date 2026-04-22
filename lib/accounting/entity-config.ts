/**
 * Entity accounting configuration reader.
 *
 * Reads the per-entity toggle (`accounting_enabled`) and declaration mode
 * (`declaration_mode`) set by the owner in /owner/accounting/settings.
 * Used by every `ensure*Entry` helper to gate entry creation and decide
 * whether an entry should be flagged `informational` (micro_foncier mode).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type DeclarationMode = "micro_foncier" | "reel" | "is_comptable";

export interface EntityAccountingConfig {
  entityId: string;
  accountingEnabled: boolean;
  declarationMode: DeclarationMode;
}

/**
 * Read the accounting configuration for a legal entity.
 * Returns `null` if the entity does not exist.
 */
export async function getEntityAccountingConfig(
  supabase: SupabaseClient,
  entityId: string,
): Promise<EntityAccountingConfig | null> {
  const { data } = await supabase
    .from("legal_entities")
    .select("id, accounting_enabled, declaration_mode")
    .eq("id", entityId)
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    id: string;
    accounting_enabled: boolean | null;
    declaration_mode: DeclarationMode | null;
  };

  return {
    entityId: row.id,
    accountingEnabled: row.accounting_enabled ?? false,
    declarationMode: row.declaration_mode ?? "reel",
  };
}

/**
 * When an entity is in micro_foncier mode, entries are still created (to feed
 * the 2044 preparation UI) but flagged `informational = true` so they are
 * excluded from FEC exports and official reports.
 */
export function shouldMarkInformational(config: EntityAccountingConfig): boolean {
  return config.declarationMode === "micro_foncier";
}

/**
 * Apply the informational flag to an entry after creation. Called by
 * ensure* helpers when the entity is in micro_foncier mode.
 */
export async function markEntryInformational(
  supabase: SupabaseClient,
  entryId: string,
): Promise<void> {
  await (supabase as unknown as {
    from: (t: string) => {
      update: (v: object) => {
        eq: (k: string, v: string) => Promise<unknown>;
      };
    };
  })
    .from("accounting_entries")
    .update({ informational: true })
    .eq("id", entryId);
}
