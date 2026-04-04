/**
 * Store persistant pour les codes OTP
 *
 * Utilise Upstash Redis en production (partagé entre instances, TTL natif).
 * Fallback en mémoire si Redis n'est pas configuré (développement).
 *
 * Clés Redis : otp:{userId} → JSON { code, phone, expiresAt, attempts }
 * TTL : 5 minutes (300 secondes)
 */

interface OTPData {
  code: string;
  phone: string;
  expiresAt: string; // ISO string pour sérialisation Redis
  attempts: number;
}

const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 900; // 15 minutes de blocage après trop de tentatives

// ── Redis client (lazy init) ──

let _redis: any | null = null;
let _redisChecked = false;

async function getRedis(): Promise<any | null> {
  if (_redisChecked) return _redis;
  _redisChecked = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const { Redis } = await import("@upstash/redis");
    _redis = new Redis({ url, token });
    return _redis;
  } catch {
    return null;
  }
}

// ── Memory fallback ──

const memoryStore = new Map<string, OTPData>();

// ── Public API ──

function otpKey(userId: string): string {
  return `otp:${userId}`;
}

function lockKey(userId: string): string {
  return `otp_lock:${userId}`;
}

/**
 * Sauvegarder un code OTP (TTL 5 min)
 */
export async function setOTP(key: string, data: { code: string; phone: string; expiresAt: Date; attempts: number }): Promise<void> {
  const serialized: OTPData = {
    code: data.code,
    phone: data.phone,
    expiresAt: data.expiresAt.toISOString(),
    attempts: data.attempts,
  };

  const redis = await getRedis();
  if (redis) {
    await redis.set(otpKey(key), JSON.stringify(serialized), { ex: OTP_TTL_SECONDS });
  } else {
    memoryStore.set(key, serialized);
    // Auto-cleanup en mémoire
    setTimeout(() => memoryStore.delete(key), OTP_TTL_SECONDS * 1000);
  }
}

/**
 * Récupérer un code OTP
 */
export async function getOTP(key: string): Promise<(OTPData & { expiresAt: Date }) | undefined> {
  const redis = await getRedis();
  let raw: OTPData | null | undefined;

  if (redis) {
    const stored = await redis.get(otpKey(key));
    raw = stored ? (typeof stored === "string" ? JSON.parse(stored) : stored as OTPData) : null;
  } else {
    raw = memoryStore.get(key);
  }

  if (!raw) return undefined;

  return {
    ...raw,
    expiresAt: new Date(raw.expiresAt),
  };
}

/**
 * Supprimer un code OTP
 */
export async function deleteOTP(key: string): Promise<boolean> {
  const redis = await getRedis();
  if (redis) {
    await redis.del(otpKey(key));
    return true;
  }
  return memoryStore.delete(key);
}

/**
 * Vérifier un code OTP
 */
export async function verifyOTP(key: string, code: string): Promise<{ valid: boolean; error?: string }> {
  // Vérifier le lockout
  const redis = await getRedis();
  if (redis) {
    const locked = await redis.get(lockKey(key));
    if (locked) {
      return { valid: false, error: "Trop de tentatives. Veuillez patienter 15 minutes avant de réessayer." };
    }
  }

  const otpData = await getOTP(key);

  if (!otpData) {
    return { valid: false, error: "Aucun code OTP trouvé. Veuillez en demander un nouveau." };
  }

  // Vérifier l'expiration
  if (new Date() > otpData.expiresAt) {
    await deleteOTP(key);
    return { valid: false, error: "Le code a expiré. Veuillez en demander un nouveau." };
  }

  // Incrémenter les tentatives
  otpData.attempts += 1;

  // Bloquer après MAX_ATTEMPTS tentatives
  if (otpData.attempts > MAX_ATTEMPTS) {
    await deleteOTP(key);
    // Set lockout
    if (redis) {
      await redis.set(lockKey(key), "1", { ex: LOCKOUT_TTL_SECONDS });
    }
    return { valid: false, error: "Trop de tentatives. Veuillez patienter 15 minutes avant de réessayer." };
  }

  // Code incorrect — sauvegarder les tentatives mises à jour
  if (otpData.code !== code) {
    const remaining = MAX_ATTEMPTS - otpData.attempts;
    // Mettre à jour le compteur
    if (redis) {
      const ttl = Math.max(1, Math.ceil((otpData.expiresAt.getTime() - Date.now()) / 1000));
      await redis.set(otpKey(key), JSON.stringify({
        code: otpData.code,
        phone: otpData.phone,
        expiresAt: otpData.expiresAt.toISOString(),
        attempts: otpData.attempts,
      }), { ex: ttl });
    } else {
      memoryStore.set(key, {
        code: otpData.code,
        phone: otpData.phone,
        expiresAt: otpData.expiresAt.toISOString(),
        attempts: otpData.attempts,
      });
    }
    return { valid: false, error: `Code incorrect. ${remaining} tentative${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}.` };
  }

  // Code valide — supprimer
  await deleteOTP(key);
  return { valid: true };
}
