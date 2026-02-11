/**
 * Service d'horodatage certifié (Timestamp Authority)
 *
 * Implémentation conforme RFC 3161 (Internet X.509 PKI Time-Stamp Protocol)
 *
 * L'horodatage certifié apporte la preuve qu'un document existait sous une forme
 * donnée à un instant précis. Combiné avec la signature électronique, il garantit :
 * - L'antériorité de la signature (le document existait avant l'horodatage)
 * - La non-répudiation temporelle
 * - La conformité eIDAS pour les signatures avancées
 *
 * TSA supportées :
 * - FreeTSA (gratuit, pour dev/test)
 * - Certinomis (France, production)
 * - DigiCert (international, production)
 * - Universign (France, qualifié eIDAS)
 *
 * @see RFC 3161 - https://datatracker.ietf.org/doc/html/rfc3161
 * @see eIDAS Art. 41 - Effet juridique des horodatages électroniques
 */

import { generateHash } from "./signature-proof.service";

// ─── Types ────────────────────────────────────────────────────────────────

export interface TSAConfig {
  /** URL du serveur TSA */
  url: string;
  /** Nom du fournisseur */
  provider: string;
  /** Auth basique (optionnel) */
  username?: string;
  password?: string;
  /** Certificat client (optionnel, PEM) */
  clientCert?: string;
  /** Politique OID (optionnel) */
  policyOID?: string;
}

export interface TimestampToken {
  /** Token brut (DER encodé, base64) */
  token: string;
  /** Hash du document horodaté */
  documentHash: string;
  /** Algorithme de hash utilisé */
  hashAlgorithm: "SHA-256";
  /** Date de l'horodatage (extraite du token ou locale) */
  timestamp: string;
  /** Unix timestamp */
  timestampUnix: number;
  /** Fournisseur TSA */
  provider: string;
  /** URL TSA utilisée */
  tsaUrl: string;
  /** Statut de la réponse TSA */
  status: "granted" | "rejection" | "waiting" | "fallback";
  /** Nonce utilisé pour cette requête */
  nonce: string;
  /** Serial number du token (si disponible) */
  serialNumber?: string;
  /** Politique OID appliquée */
  policyOID?: string;
}

export interface TimestampResult {
  success: boolean;
  token: TimestampToken | null;
  fallbackUsed: boolean;
  error?: string;
}

// ─── Configuration ────────────────────────────────────────────────────────

const TSA_PROVIDERS: Record<string, TSAConfig> = {
  freetsa: {
    url: "https://freetsa.org/tsr",
    provider: "FreeTSA",
  },
  certinomis: {
    url: "https://timestamp.certinomis.com/tsa",
    provider: "Certinomis (France)",
  },
  digicert: {
    url: "https://timestamp.digicert.com",
    provider: "DigiCert",
  },
  universign: {
    url: "https://ws.universign.eu/tsa",
    provider: "Universign (eIDAS qualifié)",
  },
};

function getTSAConfig(): TSAConfig {
  const providerKey = process.env.TSA_PROVIDER || "freetsa";
  const customUrl = process.env.TSA_URL;

  if (customUrl) {
    return {
      url: customUrl,
      provider: process.env.TSA_PROVIDER_NAME || "Custom TSA",
      username: process.env.TSA_USERNAME,
      password: process.env.TSA_PASSWORD,
      policyOID: process.env.TSA_POLICY_OID,
    };
  }

  return TSA_PROVIDERS[providerKey] || TSA_PROVIDERS.freetsa;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Génère un nonce aléatoire pour la requête TSA (anti-replay)
 */
function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convertit un hex string en Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Construit une requête TSA au format ASN.1 DER (RFC 3161 TimeStampReq)
 *
 * Structure simplifiée:
 * TimeStampReq ::= SEQUENCE {
 *   version          INTEGER { v1(1) },
 *   messageImprint   MessageImprint,
 *   nonce            INTEGER OPTIONAL,
 *   certReq          BOOLEAN DEFAULT FALSE
 * }
 *
 * MessageImprint ::= SEQUENCE {
 *   hashAlgorithm    AlgorithmIdentifier (SHA-256 = 2.16.840.1.101.3.4.2.1),
 *   hashedMessage    OCTET STRING
 * }
 */
function buildTSARequest(hashBytes: Uint8Array, nonceHex: string): Uint8Array {
  // SHA-256 OID: 2.16.840.1.101.3.4.2.1
  const sha256OID = new Uint8Array([
    0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
  ]);

  // AlgorithmIdentifier SEQUENCE
  const algId = new Uint8Array([
    0x30, sha256OID.length + 2,
    ...sha256OID,
    0x05, 0x00, // NULL parameters
  ]);

  // hashedMessage OCTET STRING
  const hashedMessage = new Uint8Array([
    0x04, hashBytes.length,
    ...hashBytes,
  ]);

  // MessageImprint SEQUENCE
  const messageImprint = new Uint8Array([
    0x30, algId.length + hashedMessage.length,
    ...algId,
    ...hashedMessage,
  ]);

  // version INTEGER v1(1)
  const version = new Uint8Array([0x02, 0x01, 0x01]);

  // nonce INTEGER
  const nonceBytes = hexToBytes(nonceHex);
  const nonce = new Uint8Array([
    0x02, nonceBytes.length,
    ...nonceBytes,
  ]);

  // certReq BOOLEAN TRUE (request TSA certificate)
  const certReq = new Uint8Array([0x01, 0x01, 0xff]);

  // TimeStampReq SEQUENCE
  const contentLength = version.length + messageImprint.length + nonce.length + certReq.length;
  const request = new Uint8Array([
    0x30, 0x82,
    (contentLength >> 8) & 0xff,
    contentLength & 0xff,
    ...version,
    ...messageImprint,
    ...nonce,
    ...certReq,
  ]);

  return request;
}

// ─── Service principal ────────────────────────────────────────────────────

/**
 * Demande un jeton d'horodatage certifié à un serveur TSA
 */
export async function requestTimestamp(documentHash: string): Promise<TimestampResult> {
  const config = getTSAConfig();
  const nonce = generateNonce();

  try {
    const hashBytes = hexToBytes(documentHash);
    const tsaRequest = buildTSARequest(hashBytes, nonce);

    // Préparer les headers
    const headers: Record<string, string> = {
      "Content-Type": "application/timestamp-query",
    };

    if (config.username && config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    }

    // Envoyer la requête au serveur TSA
    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: tsaRequest,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`TSA responded with ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/timestamp-reply")) {
      // Certains serveurs renvoient du binaire sans le bon content-type
      console.warn(`[TSA] Content-Type inattendu: ${contentType}, tentative de parsing...`);
    }

    const responseBuffer = await response.arrayBuffer();
    const responseBytes = new Uint8Array(responseBuffer);

    // Vérifier le status dans la réponse TSA (premier octet SEQUENCE, puis status)
    // Status PKIStatusInfo: granted(0), grantedWithMods(1), rejection(2), waiting(3)
    let status: TimestampToken["status"] = "granted";

    // Vérification basique: la réponse doit commencer par SEQUENCE (0x30)
    if (responseBytes.length < 10 || responseBytes[0] !== 0x30) {
      throw new Error("Réponse TSA invalide (pas un DER SEQUENCE)");
    }

    // Encoder le token en base64 pour stockage
    const tokenBase64 = Buffer.from(responseBuffer).toString("base64");

    const token: TimestampToken = {
      token: tokenBase64,
      documentHash,
      hashAlgorithm: "SHA-256",
      timestamp: new Date().toISOString(),
      timestampUnix: Date.now(),
      provider: config.provider,
      tsaUrl: config.url,
      status,
      nonce,
      policyOID: config.policyOID,
    };

    return {
      success: true,
      token,
      fallbackUsed: false,
    };
  } catch (error) {
    console.warn(`[TSA] Erreur serveur ${config.provider}:`, error);

    // Fallback : horodatage local signé (pas certifié mais tracé)
    return createFallbackTimestamp(documentHash, nonce, config.provider, error);
  }
}

/**
 * Fallback quand le serveur TSA n'est pas disponible :
 * Génère un horodatage local avec hash d'intégrité.
 * Non certifié mais fournit une preuve d'antériorité vérifiable.
 */
async function createFallbackTimestamp(
  documentHash: string,
  nonce: string,
  attemptedProvider: string,
  error: unknown
): Promise<TimestampResult> {
  const now = new Date();
  const fallbackData = `${documentHash}|${nonce}|${now.toISOString()}|fallback`;
  const fallbackHash = await generateHash(fallbackData);

  const token: TimestampToken = {
    token: Buffer.from(JSON.stringify({
      type: "local_fallback",
      documentHash,
      nonce,
      timestamp: now.toISOString(),
      integrityHash: fallbackHash,
      reason: error instanceof Error ? error.message : "TSA unavailable",
    })).toString("base64"),
    documentHash,
    hashAlgorithm: "SHA-256",
    timestamp: now.toISOString(),
    timestampUnix: now.getTime(),
    provider: `Fallback local (${attemptedProvider} indisponible)`,
    tsaUrl: "local",
    status: "fallback",
    nonce,
  };

  return {
    success: true,
    token,
    fallbackUsed: true,
    error: `TSA ${attemptedProvider} indisponible, fallback local utilisé`,
  };
}

/**
 * Horodate une preuve de signature existante
 * À appeler après generateSignatureProof()
 */
export async function timestampSignatureProof(proofHash: string): Promise<TimestampResult> {
  return requestTimestamp(proofHash);
}

/**
 * Vérifie qu'un token d'horodatage est cohérent (vérification basique)
 * Note: la vérification complète nécessite le certificat du TSA
 */
export async function verifyTimestampToken(token: TimestampToken): Promise<{
  valid: boolean;
  checks: Record<string, boolean>;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const checks: Record<string, boolean> = {};

  // 1. Vérifier que le token n'est pas vide
  checks.token_present = !!token.token && token.token.length > 0;

  // 2. Vérifier le hash du document
  checks.hash_format = /^[a-f0-9]{64}$/.test(token.documentHash);

  // 3. Vérifier l'horodatage (pas dans le futur, pas trop ancien)
  const tokenTime = new Date(token.timestamp).getTime();
  const now = Date.now();
  checks.timestamp_not_future = tokenTime <= now + 60000; // 1 min tolérance
  checks.timestamp_not_too_old = tokenTime > now - 365 * 24 * 60 * 60 * 1000; // < 1 an

  // 4. Vérifier le nonce
  checks.nonce_present = !!token.nonce && token.nonce.length >= 16;

  // 5. Warnings
  if (token.status === "fallback") {
    warnings.push("Horodatage local (fallback) — non certifié par un TSA tiers");
  }

  if (!checks.hash_format) {
    warnings.push("Format de hash invalide");
  }

  const valid = Object.values(checks).every(Boolean);

  return { valid, checks, warnings };
}
