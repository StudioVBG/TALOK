/**
 * Résolveur de sous-comptes auxiliaires.
 *
 * Quand une ligne d'écriture comptable touche un compte collectif (411
 * locataires, 401 fournisseurs, 467 mandants, 416 douteux, 406 FNP, 421
 * personnel, 444 État impôts, 456 associés) et qu'un `thirdPartyId` est
 * fourni dans le contexte analytique, on substitue le numéro de compte
 * par celui du sous-compte auxiliaire correspondant (ex. 411T00001) avant
 * l'INSERT en BDD.
 *
 * Si le sous-compte n'existe pas pour ce tiers, il est créé à la volée
 * dans `chart_of_accounts` via `getOrCreateAuxiliaryAccount` (helper
 * `lib/accounting/auxiliary-accounts.ts`).
 *
 * Branché en amont de l'INSERT dans `engine.createEntry` → bénéficie
 * automatiquement à TOUS les bridges (receipt-entry, deposit-*, invoice-
 * entry, internal-transfer-entry, etc.) sans modification individuelle.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntryLine } from "@/lib/accounting/engine";
import {
  getOrCreateAuxiliaryAccount,
  type ThirdPartyType,
} from "@/lib/accounting/auxiliary-accounts";

/**
 * Mapping comptes collectifs → types de tiers acceptés.
 * Si la ligne touche un de ces comptes ET que `thirdPartyType` matche,
 * la substitution s'applique. Sinon le compte collectif reste.
 */
const COLLECTIVE_ACCOUNTS: Record<string, ThirdPartyType[]> = {
  "411000": ["tenant"],
  "416000": ["tenant"], // douteux
  "401000": ["vendor"],
  "406000": ["vendor"], // factures non parvenues
  "467000": ["mandant", "landlord"],
  "421000": ["employee"],
  "444000": ["tax_authority"],
  "450000": ["copro_owner"], // copropriétaire compte général
};

/**
 * Cache du label par tiers — évite les SELECT répétés quand plusieurs
 * lignes touchent le même tiers (cas typique du dépôt de garantie qui
 * mouvemente 411 + 165 sur le même locataire).
 */
type LabelCache = Map<string, string>;

async function resolvePartyLabel(
  supabase: SupabaseClient,
  partyType: ThirdPartyType,
  partyId: string,
  cache: LabelCache,
): Promise<string> {
  const cacheKey = `${partyType}:${partyId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let label = `Tiers ${partyId.slice(0, 8)}`; // fallback
  try {
    if (
      partyType === "tenant" ||
      partyType === "landlord" ||
      partyType === "mandant" ||
      partyType === "copro_owner" ||
      partyType === "employee"
    ) {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("prenom, nom")
        .eq("id", partyId)
        .maybeSingle();
      if (data) {
        const profile = data as { prenom?: string | null; nom?: string | null };
        const composed = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim();
        if (composed) label = composed;
      }
    } else if (partyType === "vendor") {
      const { data } = await (supabase as any)
        .from("providers")
        .select("nom_societe, nom_contact")
        .eq("id", partyId)
        .maybeSingle();
      if (data) {
        const provider = data as {
          nom_societe?: string | null;
          nom_contact?: string | null;
        };
        label = provider.nom_societe ?? provider.nom_contact ?? label;
      }
    } else if (partyType === "tax_authority") {
      label = "Trésor public";
    }
  } catch (err) {
    console.warn(
      "[auxiliary-resolver] resolvePartyLabel failed, fallback to UUID:",
      err,
    );
  }
  cache.set(cacheKey, label);
  return label;
}

/**
 * Substitue les comptes collectifs par leurs sous-comptes auxiliaires
 * sur les lignes qui portent un `thirdPartyId`. Crée le sous-compte
 * dans `chart_of_accounts` si nécessaire (idempotent).
 *
 * Lignes inchangées si :
 *   - thirdPartyId ou thirdPartyType absent
 *   - account_number n'est pas un compte collectif connu
 *   - thirdPartyType ne matche pas le type attendu pour ce compte
 *     (ex. on ne substitue pas 411 avec un thirdPartyType='vendor')
 */
export async function resolveAuxiliaryAccounts(
  supabase: SupabaseClient,
  entityId: string,
  lines: EntryLine[],
): Promise<EntryLine[]> {
  // Optimisation : si aucune ligne n'a de thirdPartyId, retour direct.
  if (!lines.some((l) => l.thirdPartyId && l.thirdPartyType)) {
    return lines;
  }

  const labelCache: LabelCache = new Map();
  const out: EntryLine[] = [];

  for (const line of lines) {
    if (!line.thirdPartyId || !line.thirdPartyType) {
      out.push(line);
      continue;
    }

    const validTypes = COLLECTIVE_ACCOUNTS[line.accountNumber];
    if (!validTypes || !validTypes.includes(line.thirdPartyType)) {
      // Compte non collectif (ex. 512100 banque) ou type incompatible :
      // on conserve la ligne telle quelle, l'axe analytique
      // (third_party_id) reste tracé mais le compte ne change pas.
      out.push(line);
      continue;
    }

    const partyLabel = await resolvePartyLabel(
      supabase,
      line.thirdPartyType,
      line.thirdPartyId,
      labelCache,
    );

    try {
      const { accountNumber } = await getOrCreateAuxiliaryAccount(
        supabase,
        entityId,
        line.accountNumber,
        line.thirdPartyType,
        line.thirdPartyId,
        partyLabel,
      );
      out.push({ ...line, accountNumber });
    } catch (err) {
      console.error(
        `[auxiliary-resolver] Failed to resolve aux for ${line.accountNumber} / ${line.thirdPartyType}:${line.thirdPartyId}, keeping collective:`,
        err,
      );
      out.push(line); // fallback : on garde le compte collectif
    }
  }

  return out;
}
