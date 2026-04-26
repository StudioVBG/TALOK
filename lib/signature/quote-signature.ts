/**
 * Service de signature electronique avancee pour les devis prestataire.
 *
 * Implemente eIDAS niveau 2 (AES) sans dependance tierce :
 *   1. Hash SHA-256 du contenu canonique (integrite)
 *   2. HMAC-SHA256 du hash + metadata (preuve d'origine serveur)
 *   3. Verification par recomputation
 *
 * Ne gere PAS la generation/envoi d'OTP — voir lib/signature/quote-otp.ts.
 */

import { createHash, createHmac, randomBytes, pbkdf2Sync } from "node:crypto";

/**
 * Seuil en cents au-dela duquel la signature avancee est requise.
 * Defaut 10 000 EUR TTC (= 1 000 000 cents) — ajustable via env.
 */
export function getAdvancedSignatureThresholdCents(): number {
  const env = process.env.QUOTE_ADVANCED_SIGNATURE_THRESHOLD_CENTS;
  if (env) {
    const n = parseInt(env, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1_000_000; // 10 000 EUR
}

/** Convertit total_amount (DB DECIMAL) en cents entiers. */
export function toCents(amount: number | string | null | undefined): number {
  if (amount == null) return 0;
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function requiresAdvancedSignature(totalAmount: number | string | null | undefined): boolean {
  return toCents(totalAmount) > getAdvancedSignatureThresholdCents();
}

// ============================================================================
// HASH CANONIQUE DU DEVIS
// ============================================================================

export interface QuoteCanonicalItem {
  description: string;
  quantity: number | string;
  unit?: string | null;
  unit_price: number | string;
  tax_rate: number | string;
  sort_order?: number | null;
}

export interface QuoteCanonicalInput {
  id: string;
  reference: string;
  title: string;
  description?: string | null;
  subtotal: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  valid_until?: string | null;
  created_at: string;
  provider_profile_id: string;
  owner_profile_id?: string | null;
  property_id?: string | null;
  ticket_id?: string | null;
  terms_and_conditions?: string | null;
  items: QuoteCanonicalItem[];
}

/**
 * Construit la representation canonique JSON du devis. L'ordre des cles
 * est figé pour garantir un hash deterministe entre versions / serveurs.
 *
 * Toute modification ulterieure d'un de ces champs invaliderait le hash.
 */
function canonicalizeQuote(quote: QuoteCanonicalInput): string {
  const sortedItems = [...quote.items]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((it) => ({
      description: String(it.description ?? "").trim(),
      quantity: Number(it.quantity ?? 0),
      unit: it.unit ?? null,
      unit_price: Number(it.unit_price ?? 0),
      tax_rate: Number(it.tax_rate ?? 0),
    }));

  // Ordre des cles fige — JSON.stringify d'un object literal preserve l'ordre
  const canonical = {
    id: quote.id,
    reference: quote.reference,
    title: quote.title,
    description: quote.description ?? null,
    subtotal: Number(quote.subtotal ?? 0),
    tax_amount: Number(quote.tax_amount ?? 0),
    total_amount: Number(quote.total_amount ?? 0),
    valid_until: quote.valid_until ?? null,
    created_at: quote.created_at,
    provider_profile_id: quote.provider_profile_id,
    owner_profile_id: quote.owner_profile_id ?? null,
    property_id: quote.property_id ?? null,
    ticket_id: quote.ticket_id ?? null,
    terms_and_conditions: quote.terms_and_conditions ?? null,
    items: sortedItems,
  };

  return JSON.stringify(canonical);
}

/**
 * Calcule le hash SHA-256 du contenu canonique du devis.
 * Retourne un hex de 64 caracteres.
 */
export function computeQuoteHash(quote: QuoteCanonicalInput): string {
  const canonical = canonicalizeQuote(quote);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ============================================================================
// HMAC SIGNATURE
// ============================================================================

function getHmacKey(): Buffer {
  const key = process.env.SIGNATURE_HMAC_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      "SIGNATURE_HMAC_KEY env var manquant ou trop court (>= 32 caracteres requis). " +
        "Generer via: openssl rand -hex 32",
    );
  }
  return Buffer.from(key, "utf8");
}

/**
 * Signe le tuple (document_hash, quote_id, signed_at_iso) avec HMAC-SHA256.
 * Le message inclut quote_id et timestamp pour empecher le rejeu d'un hash
 * d'un autre devis ou d'un autre instant.
 */
export function signQuoteHash(params: {
  documentHash: string;
  quoteId: string;
  signedAtIso: string;
}): string {
  const message = `${params.documentHash}|${params.quoteId}|${params.signedAtIso}`;
  return createHmac("sha256", getHmacKey()).update(message, "utf8").digest("hex");
}

/**
 * Verifie que le HMAC correspond bien au tuple attendu.
 * Comparaison time-safe via subtle equal logique.
 */
export function verifyHmac(params: {
  documentHash: string;
  quoteId: string;
  signedAtIso: string;
  hmac: string;
}): boolean {
  try {
    const expected = signQuoteHash({
      documentHash: params.documentHash,
      quoteId: params.quoteId,
      signedAtIso: params.signedAtIso,
    });
    if (expected.length !== params.hmac.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ params.hmac.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// ============================================================================
// VERIFICATION COMPLETE D'UN DEVIS SIGNE
// ============================================================================

export interface QuoteSignatureVerification {
  valid: boolean;
  level: "simple" | "advanced" | null;
  /** Le hash actuel correspond bien au hash signe (integrite OK) */
  hashMatches: boolean | null;
  /** Le HMAC correspond bien au hash signe (origine serveur OK) */
  hmacValid: boolean | null;
  /** Hash recompute a partir des donnees DB courantes */
  currentHash: string;
  /** Hash original au moment de la signature (lu en DB) */
  storedHash: string | null;
  signedName: string | null;
  signedAt: string | null;
  reasons: string[];
}

/**
 * Verifie l'integrite et l'origine d'une signature de devis.
 * - Si signature_level IS NULL : devis non signe (valid=false)
 * - Si 'simple' : pas de hash a verifier, valid=true si signed_name present
 * - Si 'advanced' : recalcule hash + HMAC et compare
 */
export function verifyQuoteSignature(quote: {
  signature_level?: "simple" | "advanced" | null;
  signature_document_hash?: string | null;
  signature_hmac?: string | null;
  acceptance_signed_name?: string | null;
  acceptance_signed_at?: string | null;
  id: string;
  reference: string;
  title: string;
  description?: string | null;
  subtotal: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  valid_until?: string | null;
  created_at: string;
  provider_profile_id: string;
  owner_profile_id?: string | null;
  property_id?: string | null;
  ticket_id?: string | null;
  terms_and_conditions?: string | null;
  items: QuoteCanonicalItem[];
}): QuoteSignatureVerification {
  const reasons: string[] = [];

  if (!quote.signature_level) {
    return {
      valid: false,
      level: null,
      hashMatches: null,
      hmacValid: null,
      currentHash: "",
      storedHash: null,
      signedName: quote.acceptance_signed_name ?? null,
      signedAt: quote.acceptance_signed_at ?? null,
      reasons: ["Devis non signe"],
    };
  }

  if (quote.signature_level === "simple") {
    const ok = !!quote.acceptance_signed_name;
    if (!ok) reasons.push("Signature simple sans nom signataire");
    return {
      valid: ok,
      level: "simple",
      hashMatches: null,
      hmacValid: null,
      currentHash: "",
      storedHash: null,
      signedName: quote.acceptance_signed_name ?? null,
      signedAt: quote.acceptance_signed_at ?? null,
      reasons,
    };
  }

  // Advanced
  const currentHash = computeQuoteHash(quote);
  const storedHash = quote.signature_document_hash ?? null;
  const hmac = quote.signature_hmac ?? null;
  const signedAt = quote.acceptance_signed_at ?? null;

  const hashMatches = !!storedHash && currentHash === storedHash;
  if (!hashMatches) reasons.push("Hash courant ≠ hash signe (devis modifie)");

  let hmacValid = false;
  if (storedHash && hmac && signedAt) {
    hmacValid = verifyHmac({
      documentHash: storedHash,
      quoteId: quote.id,
      signedAtIso: signedAt,
      hmac,
    });
    if (!hmacValid) reasons.push("HMAC invalide (preuve d'origine serveur cassee)");
  } else {
    reasons.push("Donnees de signature avancee incompletes");
  }

  return {
    valid: hashMatches && hmacValid,
    level: "advanced",
    hashMatches,
    hmacValid,
    currentHash,
    storedHash,
    signedName: quote.acceptance_signed_name ?? null,
    signedAt,
    reasons,
  };
}

// ============================================================================
// OTP (helpers partages avec quote-otp.ts)
// ============================================================================

const OTP_LENGTH = 6;

export function generateOtpCode(): string {
  const buf = randomBytes(4);
  const num = buf.readUInt32BE(0);
  return (num % 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

export function hashOtpCode(code: string, salt: string): string {
  return pbkdf2Sync(code, salt, 10000, 32, "sha256").toString("hex");
}

export function generateOtpSalt(): string {
  return randomBytes(16).toString("hex");
}
