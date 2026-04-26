/**
 * Sous-comptes auxiliaires par tiers — exigence expert-comptable.
 *
 * En PCG français, les comptes collectifs (411 Locataires, 401 Fournisseurs,
 * 467 Mandants…) doivent être déclinés en sous-comptes auxiliaires par tiers
 * pour permettre :
 *   - Le grand livre par locataire / fournisseur / propriétaire mandant
 *   - Le lettrage par tiers
 *   - Le rapprochement avec les balances âgées
 *
 * Convention de nommage : `{base}{prefix}{seq}` où :
 *   - base = compte collectif (411, 401, 467…)
 *   - prefix = T (tenant) | F (vendor) | P (landlord) | M (mandant)
 *   - seq = numéro séquentiel 5 chiffres par tiers (00001, 00002…)
 *
 * Exemples :
 *   411T00001  → Premier locataire (Mme Dupont)
 *   411T00002  → Deuxième locataire (M. Martin)
 *   401F00001  → Premier fournisseur
 *   467P00001  → Premier propriétaire mandant
 *
 * Idempotent : si un compte existe déjà pour le tiers, on le retourne tel quel.
 * Le mapping `(entity_id, third_party_type, third_party_id) → account_number`
 * est stocké dans la colonne `metadata` de `chart_of_accounts` pour pouvoir
 * retrouver le compte sans table de jointure dédiée.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ThirdPartyType =
  | "tenant"
  | "landlord"
  | "vendor"
  | "mandant"
  | "copro_owner"
  | "employee"
  | "tax_authority";

const PREFIX_BY_TYPE: Record<ThirdPartyType, string> = {
  tenant: "T",
  landlord: "P",
  vendor: "F",
  mandant: "M",
  copro_owner: "C",
  employee: "E",
  tax_authority: "X",
};

const ACCOUNT_TYPE_BY_BASE: Record<
  string,
  "asset" | "liability" | "equity" | "income" | "expense"
> = {
  "411": "asset", // Locataires créances
  "416": "asset", // Locataires douteux
  "401": "liability", // Fournisseurs
  "406": "liability", // Fournisseurs - factures non parvenues
  "467": "liability", // Compte mandant
  "421": "liability", // Personnel
  "444": "liability", // État impôts
  "456": "asset", // Associés
};

interface AuxiliaryLookupResult {
  accountNumber: string;
  created: boolean;
}

/**
 * Retourne le numéro de sous-compte auxiliaire pour un tiers donné, en le
 * créant dans `chart_of_accounts` si nécessaire.
 *
 * @param baseAccount Le compte collectif (ex. '411000', '401000')
 * @param partyId UUID du tiers (profiles.id, providers.id…)
 * @param partyType Type discriminant (tenant, vendor, landlord…)
 * @param partyLabel Libellé descriptif (nom du tiers) — repris dans le
 *                   chart_of_accounts.label
 */
export async function getOrCreateAuxiliaryAccount(
  supabase: SupabaseClient,
  entityId: string,
  baseAccount: string,
  partyType: ThirdPartyType,
  partyId: string,
  partyLabel: string,
): Promise<AuxiliaryLookupResult> {
  const baseClass = baseAccount.substring(0, 3);
  const prefix = PREFIX_BY_TYPE[partyType];

  // 1. Lookup existant via la metadata (party_id stocké pour retrouver
  // le compte sans table de jointure dédiée).
  const { data: existing } = await (supabase as any)
    .from("chart_of_accounts")
    .select("account_number")
    .eq("entity_id", entityId)
    .like("account_number", `${baseClass}${prefix}%`)
    .contains("metadata", { third_party_id: partyId })
    .limit(1)
    .maybeSingle();

  if (existing?.account_number) {
    return { accountNumber: existing.account_number as string, created: false };
  }

  // 2. Détermine la prochaine séquence pour ce préfixe.
  const { data: lastAccount } = await (supabase as any)
    .from("chart_of_accounts")
    .select("account_number")
    .eq("entity_id", entityId)
    .like("account_number", `${baseClass}${prefix}%`)
    .order("account_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSeq = 1;
  if (lastAccount?.account_number) {
    const seqStr = (lastAccount.account_number as string).slice(
      `${baseClass}${prefix}`.length,
    );
    const parsed = parseInt(seqStr, 10);
    if (Number.isFinite(parsed)) nextSeq = parsed + 1;
  }

  const newAccountNumber = `${baseClass}${prefix}${String(nextSeq).padStart(5, "0")}`;
  const accountType = ACCOUNT_TYPE_BY_BASE[baseClass] ?? "asset";

  // 3. Insère le nouveau compte avec metadata pour retrouvabilité.
  const { error } = await (supabase as any)
    .from("chart_of_accounts")
    .insert({
      entity_id: entityId,
      account_number: newAccountNumber,
      label: `${partyLabel} (${baseClass})`,
      account_type: accountType,
      plan_type: "custom",
      metadata: {
        third_party_id: partyId,
        third_party_type: partyType,
        parent_account: baseAccount,
      },
    });

  if (error) {
    // Race condition possible : un autre process a créé le compte entre
    // notre SELECT et notre INSERT. On retombe sur un nouveau lookup.
    const { data: retry } = await (supabase as any)
      .from("chart_of_accounts")
      .select("account_number")
      .eq("entity_id", entityId)
      .like("account_number", `${baseClass}${prefix}%`)
      .contains("metadata", { third_party_id: partyId })
      .limit(1)
      .maybeSingle();
    if (retry?.account_number) {
      return { accountNumber: retry.account_number as string, created: false };
    }
    throw new Error(
      `Failed to create auxiliary account ${newAccountNumber}: ${error.message}`,
    );
  }

  return { accountNumber: newAccountNumber, created: true };
}
