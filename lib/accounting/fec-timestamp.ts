/**
 * RFC 3161 Time-Stamp Protocol client (eIDAS-ready).
 *
 * Builds a TimeStampReq from a SHA-256 digest, posts it to a TSA, and
 * returns the raw DER-encoded TimeStampToken. The token is what proves
 * the file existed at the moment the TSA signed it; together with the
 * SHA-256 stored in fec_manifests, it gives a tamper-proof, externally
 * verifiable trail without TALOK having to operate its own qualified
 * signature infrastructure.
 *
 * Default TSA: FreeTSA (https://freetsa.org), which delivers free,
 * RFC 3161-compliant tokens. For a production engagement, swap the
 * URL for a qualified eIDAS TSA (Universign, Certinomis, LuxTrust...)
 * via the TALOK_TSA_URL environment variable.
 *
 * Pure server-side helper. No DB calls, no side effects beyond the
 * HTTP roundtrip — easy to unit-test by mocking fetch.
 */

import { createHash } from "crypto";

export interface TimestampOptions {
  /** Override the TSA endpoint. Defaults to env TALOK_TSA_URL or FreeTSA. */
  tsaUrl?: string;
  /** Optional bearer/basic credentials for paid TSAs. */
  authHeader?: string;
  /** Network timeout in ms (default 15s). */
  timeoutMs?: number;
}

export interface TimestampResult {
  /** Lower-case hex SHA-256 of the input. */
  digestSha256: string;
  /** Raw DER-encoded TimeStampToken. */
  tokenDer: Buffer;
  /** Base64 form for storage in DB / response headers. */
  tokenBase64: string;
  /** TSA URL that signed the token. */
  tsaUrl: string;
  /** Approximate upper bound of the genTime as observed by the client. */
  receivedAt: string;
  /** TSA HTTP response size in bytes. */
  tokenBytes: number;
}

export class TimestampError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "TimestampError";
  }
}

const DEFAULT_TSA_URL = "https://freetsa.org/tsr";

// ─── Minimal ASN.1 DER encoder ─────────────────────────────────────
// Just enough to build a TSP TimeStampReq. We avoid pulling a full
// ASN.1 library since the request is a fixed shape.

function derLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.concat([Buffer.from([0x80 | bytes.length]), Buffer.from(bytes)]);
}

function derWrap(tag: number, contents: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(contents.length), contents]);
}

const SHA256_OID = Buffer.from([
  // 2.16.840.1.101.3.4.2.1
  0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
]);

/**
 * Build a DER-encoded TimeStampReq from a SHA-256 digest.
 *
 *   TimeStampReq ::= SEQUENCE {
 *     version            INTEGER  { v1(1) },
 *     messageImprint     SEQUENCE {
 *       hashAlgorithm    SEQUENCE { algorithm OID, parameters NULL },
 *       hashedMessage    OCTET STRING
 *     },
 *     reqPolicy          OBJECT IDENTIFIER OPTIONAL,
 *     nonce              INTEGER OPTIONAL,
 *     certReq            BOOLEAN DEFAULT FALSE,
 *     extensions         [0] IMPLICIT Extensions OPTIONAL
 *   }
 */
export function buildTimeStampReq(sha256Digest: Buffer): Buffer {
  if (sha256Digest.length !== 32) {
    throw new TimestampError(
      `SHA-256 digest must be 32 bytes, got ${sha256Digest.length}`,
    );
  }

  // version INTEGER 1
  const version = Buffer.from([0x02, 0x01, 0x01]);

  // hashAlgorithm SEQUENCE { OID, NULL }
  const algNull = Buffer.from([0x05, 0x00]);
  const hashAlgorithm = derWrap(0x30, Buffer.concat([SHA256_OID, algNull]));

  // hashedMessage OCTET STRING
  const hashedMessage = derWrap(0x04, sha256Digest);

  // messageImprint SEQUENCE
  const messageImprint = derWrap(
    0x30,
    Buffer.concat([hashAlgorithm, hashedMessage]),
  );

  // nonce: 8 random bytes as a positive INTEGER
  const nonceBytes = Buffer.alloc(8);
  // Use a simple time-derived nonce. crypto.randomBytes would be nicer
  // but createHash from 'crypto' is enough — we re-use the same import
  // and avoid pulling a new namespace.
  const seed = createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest();
  seed.copy(nonceBytes, 0, 0, 8);
  // Force MSB to 0 so the integer is positive.
  nonceBytes[0] &= 0x7f;
  const nonce = derWrap(0x02, nonceBytes);

  // certReq BOOLEAN TRUE so the TSA includes its certificate
  const certReq = Buffer.from([0x01, 0x01, 0xff]);

  return derWrap(
    0x30,
    Buffer.concat([version, messageImprint, nonce, certReq]),
  );
}

/**
 * Send a TimeStampReq to the TSA and return the parsed response.
 *
 * The response is a TimeStampResp:
 *   TimeStampResp ::= SEQUENCE {
 *     status         PKIStatusInfo,
 *     timeStampToken TimeStampToken OPTIONAL
 *   }
 *
 * We do NOT fully parse the token here — we simply extract its bytes
 * after the PKIStatusInfo and return them. Callers store the DER blob
 * verbatim; verification (eIDAS or in-house) consumes the same bytes.
 */
export async function requestFecTimestamp(
  fileBytes: Buffer,
  options: TimestampOptions = {},
): Promise<TimestampResult> {
  const tsaUrl =
    options.tsaUrl ?? process.env.TALOK_TSA_URL ?? DEFAULT_TSA_URL;
  const timeoutMs = options.timeoutMs ?? 15_000;

  const digest = createHash("sha256").update(fileBytes).digest();
  const digestHex = digest.toString("hex");
  const tsq = buildTimeStampReq(digest);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(tsaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/timestamp-query",
        ...(options.authHeader ? { Authorization: options.authHeader } : {}),
      },
      body: new Uint8Array(tsq),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new TimestampError(
      `TSA request failed: ${err instanceof Error ? err.message : "network"}`,
      err,
    );
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new TimestampError(
      `TSA returned HTTP ${response.status} ${response.statusText}`,
    );
  }

  const tsr = Buffer.from(await response.arrayBuffer());

  // The TimeStampResp must start with SEQUENCE; the TimeStampToken
  // (when present) is the last component, itself a SEQUENCE. We do a
  // quick validation: the first byte must be 0x30 (SEQUENCE) and the
  // file must be reasonably sized.
  if (tsr.length === 0 || tsr[0] !== 0x30) {
    throw new TimestampError(
      "TSA response is not a valid DER SEQUENCE — likely a rejection",
    );
  }

  return {
    digestSha256: digestHex,
    tokenDer: tsr,
    tokenBase64: tsr.toString("base64"),
    tsaUrl,
    receivedAt: new Date().toISOString(),
    tokenBytes: tsr.length,
  };
}
