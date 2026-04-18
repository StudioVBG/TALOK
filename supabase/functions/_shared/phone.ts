/**
 * Normalisation E.164 côté Deno (Edge Functions Supabase).
 *
 * Version Deno-compatible de lib/sms/phone.ts — règles DROM identiques
 * mais sans dépendance à libphonenumber-js (pour limiter le bundle Deno).
 * À maintenir synchronisée manuellement avec lib/sms/phone.ts.
 */

export type Territory =
  | "FR" | "MQ" | "GP" | "GF" | "RE" | "YT"
  | "PM" | "NC" | "PF" | "WF" | "BL" | "MF";

const TERRITORY_TO_COUNTRY_CODE: Record<Territory, string> = {
  FR: "33",
  MQ: "596",
  GP: "590",
  GF: "594",
  RE: "262",
  YT: "262",
  PM: "508",
  NC: "687",
  PF: "689",
  WF: "681",
  BL: "590",
  MF: "590",
};

const DROM_PREFIXES: Record<string, Territory> = {
  "0596": "MQ", "0696": "MQ", "0697": "MQ",
  "0590": "GP", "0690": "GP", "0691": "GP",
  "0594": "GF", "0694": "GF",
  "0262": "RE", "0692": "RE", "0693": "RE",
  "0269": "YT", "0639": "YT",
  "0508": "PM",
};

function stripSeparators(raw: string): string {
  return raw.replace(/[\s.\-()\u00A0]/g, "");
}

/**
 * Normalise un numéro vers E.164. Fallback FR métropole (+33).
 * Retourne null si le numéro est trop court ou manifestement invalide.
 */
export function normalizePhoneE164(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = stripSeparators(raw);

  if (cleaned.startsWith("+")) {
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) return null;
    return cleaned;
  }

  const prefix4 = cleaned.slice(0, 4);
  const territory = DROM_PREFIXES[prefix4];

  if (territory && cleaned.length === 10 && cleaned.startsWith("0")) {
    return `+${TERRITORY_TO_COUNTRY_CODE[territory]}${cleaned.slice(1)}`;
  }

  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    return `+33${cleaned.slice(1)}`;
  }

  // Numéros déjà en format "33..." ou "596..."
  if (/^\d{8,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
}

export function maskPhone(e164: string | null): string {
  if (!e164 || e164.length < 7) return "***";
  return `${e164.slice(0, 7)}***${e164.slice(-3)}`;
}
