# GUIDE D'AMÉLIORATIONS DÉTAILLÉ - TALOK

**Basé sur l'audit technique du 28 janvier 2026**
**Document de référence** : `AUDIT-TECHNIQUE-2026-01.md`

Ce document fournit des **solutions techniques détaillées** avec du code prêt à l'emploi pour chaque problème identifié dans l'audit.

---

## TABLE DES MATIÈRES

1. [Corrections Critiques (P0)](#1-corrections-critiques-p0)
2. [Corrections Importantes (P1)](#2-corrections-importantes-p1)
3. [Améliorations Backlog (P2)](#3-améliorations-backlog-p2)
4. [Plan d'Implémentation](#4-plan-dimplémentation)
5. [Tests & Validation](#5-tests--validation)
6. [Checklist de Déploiement](#6-checklist-de-déploiement)

---

## 1. CORRECTIONS CRITIQUES (P0)

### 1.1 [SEC-001] Supprimer les secrets par défaut

#### Fichier : `/lib/helpers/encryption.ts`

**Problème** : Clé de chiffrement avec fallback hardcodé.

**Solution complète** :

```typescript
/**
 * Utilitaires de chiffrement pour les clés API
 * Utilise AES-256-GCM pour un chiffrement sécurisé
 *
 * IMPORTANT: Requiert API_KEY_MASTER_KEY en variable d'environnement
 */

import crypto from "crypto";

// ✅ CORRECTION: Validation stricte de la clé au démarrage
function getMasterKey(): string {
  const masterKey = process.env.API_KEY_MASTER_KEY;

  if (!masterKey) {
    throw new Error(
      "[CRITICAL] API_KEY_MASTER_KEY is required. " +
      "Set this environment variable with a 32+ character secret key."
    );
  }

  if (masterKey.length < 32) {
    throw new Error(
      "[CRITICAL] API_KEY_MASTER_KEY must be at least 32 characters long."
    );
  }

  return masterKey;
}

/**
 * Chiffre une clé API avec AES-256-GCM
 */
export function encryptKey(plainKey: string): string {
  const masterKey = getMasterKey();
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(masterKey, "external-api-salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(plainKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

/**
 * Déchiffre une clé API chiffrée
 */
export function decryptKey(encryptedKey: string): string {
  const masterKey = getMasterKey();
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(masterKey, "external-api-salt", 32);
  const [ivHex, authTagHex, encrypted] = encryptedKey.split(":");

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted key format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Vérification au chargement du module (fail-fast)
 */
if (typeof window === "undefined") {
  // Côté serveur uniquement
  try {
    getMasterKey();
  } catch (error) {
    console.error(error);
    if (process.env.NODE_ENV === "production") {
      process.exit(1); // Arrêter le serveur si clé manquante en production
    }
  }
}
```

#### Fichier : `/lib/security/csrf.ts`

**Solution complète** :

```typescript
/**
 * Protection CSRF (Cross-Site Request Forgery)
 *
 * IMPORTANT: Requiert CSRF_SECRET en variable d'environnement
 */

import { randomBytes, createHmac, timingSafeEqual } from "crypto";

// ✅ CORRECTION: Pas de fallback, validation stricte
function getCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET;

  if (!secret) {
    throw new Error(
      "[CRITICAL] CSRF_SECRET is required. " +
      "Set this environment variable with a secure random string (32+ characters)."
    );
  }

  if (secret.length < 32) {
    throw new Error(
      "[CRITICAL] CSRF_SECRET must be at least 32 characters long."
    );
  }

  return secret;
}

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 heures

/**
 * Génère un token CSRF sécurisé
 */
export function generateCsrfToken(): string {
  const secret = getCsrfSecret();
  const token = randomBytes(TOKEN_LENGTH).toString("hex");
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const data = `${token}:${expiry}`;
  const signature = createHmac("sha256", secret).update(data).digest("hex");
  return `${data}:${signature}`;
}

/**
 * Valide un token CSRF avec timing-safe comparison
 */
export function validateCsrfToken(token: string | null): boolean {
  if (!token) return false;

  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [value, expiryStr, signature] = parts;
  const expiry = parseInt(expiryStr, 10);

  // Vérifier l'expiration
  if (isNaN(expiry) || expiry < Date.now()) {
    return false;
  }

  // Vérifier la signature avec timing-safe comparison
  const secret = getCsrfSecret();
  const data = `${value}:${expiryStr}`;
  const expectedSignature = createHmac("sha256", secret).update(data).digest("hex");

  try {
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// ... reste du fichier inchangé
```

#### Fichier : `/lib/config/env-validation.ts` (NOUVEAU)

**Créer ce fichier** pour validation centralisée des variables d'environnement :

```typescript
/**
 * Validation centralisée des variables d'environnement
 * Exécuté au démarrage de l'application
 */

interface EnvVar {
  name: string;
  required: boolean;
  minLength?: number;
  validator?: (value: string) => boolean;
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  // Sécurité
  { name: "API_KEY_MASTER_KEY", required: true, minLength: 32 },
  { name: "CSRF_SECRET", required: true, minLength: 32 },

  // Supabase
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true },

  // Stripe
  { name: "STRIPE_SECRET_KEY", required: true },
  { name: "STRIPE_WEBHOOK_SECRET", required: true },

  // Optionnels mais recommandés en production
  { name: "YOUSIGN_WEBHOOK_SECRET", required: process.env.NODE_ENV === "production" },
  { name: "CRON_SECRET", required: process.env.NODE_ENV === "production" },
];

export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];

    if (envVar.required && !value) {
      errors.push(`Missing required environment variable: ${envVar.name}`);
      continue;
    }

    if (value && envVar.minLength && value.length < envVar.minLength) {
      errors.push(
        `${envVar.name} must be at least ${envVar.minLength} characters (got ${value.length})`
      );
    }

    if (value && envVar.validator && !envVar.validator(value)) {
      errors.push(`${envVar.name} failed validation`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Lancer la validation au démarrage (côté serveur uniquement)
 */
export function assertEnvironment(): void {
  if (typeof window !== "undefined") return;

  const { valid, errors } = validateEnvironment();

  if (!valid) {
    console.error("Environment validation failed:");
    errors.forEach((e) => console.error(`  - ${e}`));

    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment configuration. Check logs for details.");
    } else {
      console.warn("⚠️ Running in development mode with invalid environment");
    }
  }
}
```

---

### 1.2 [SEC-002] Corriger la vulnérabilité SSRF sur /api/scrape

#### Fichier : `/app/api/scrape/route.ts`

**Ajouter en début de fichier** :

```typescript
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { createClient } from "@/lib/supabase/server";
import { ApiError, handleApiError } from "@/lib/helpers/api-error";

// ✅ CORRECTION SEC-002: Validation d'URL anti-SSRF
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  // Metadata endpoints cloud
  "169.254.169.254", // AWS/GCP/Azure metadata
  "metadata.google.internal",
  "metadata.google",
];

const BLOCKED_IP_RANGES = [
  /^10\./,                    // Private 10.x.x.x
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // Private 172.16-31.x.x
  /^192\.168\./,              // Private 192.168.x.x
  /^127\./,                   // Loopback
  /^169\.254\./,              // Link-local
  /^0\./,                     // Reserved
];

const ALLOWED_PROTOCOLS = ["http:", "https:"];

const ALLOWED_DOMAINS = [
  "leboncoin.fr",
  "www.leboncoin.fr",
  "seloger.com",
  "www.seloger.com",
  "pap.fr",
  "www.pap.fr",
  "logic-immo.com",
  "www.logic-immo.com",
  "bienici.com",
  "www.bienici.com",
  "orpi.com",
  "www.orpi.com",
  "century21.fr",
  "www.century21.fr",
  "laforet.com",
  "www.laforet.com",
  // Ajouter d'autres domaines autorisés si nécessaire
];

function isUrlAllowed(url: string): { allowed: boolean; reason?: string } {
  try {
    const urlObj = new URL(url);

    // Vérifier le protocole
    if (!ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
      return { allowed: false, reason: "Protocol not allowed" };
    }

    // Vérifier les hosts bloqués
    if (BLOCKED_HOSTS.includes(urlObj.hostname)) {
      return { allowed: false, reason: "Host blocked" };
    }

    // Vérifier les ranges IP privées
    for (const range of BLOCKED_IP_RANGES) {
      if (range.test(urlObj.hostname)) {
        return { allowed: false, reason: "Private IP range blocked" };
      }
    }

    // Vérifier les domaines autorisés (whitelist)
    const domain = urlObj.hostname.toLowerCase();
    const isAllowedDomain = ALLOWED_DOMAINS.some(
      (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
    );

    if (!isAllowedDomain) {
      return { allowed: false, reason: `Domain not in whitelist: ${domain}` };
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Invalid URL format" };
  }
}

export async function POST(request: Request) {
  try {
    // ✅ CORRECTION: Authentification requise
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, "Authentification requise");
    }

    // ✅ CORRECTION: Vérifier le rôle (owner ou admin uniquement)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["owner", "admin"].includes(profile.role)) {
      throw new ApiError(403, "Accès non autorisé");
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    // ✅ CORRECTION: Validation anti-SSRF
    const validation = isUrlAllowed(url);
    if (!validation.allowed) {
      console.warn(`[Scrape] URL rejected: ${url} - Reason: ${validation.reason}`);
      return NextResponse.json(
        { error: "URL non autorisée", reason: validation.reason },
        { status: 400 }
      );
    }

    console.log(`\n[Scrape] 🔍 Analyse: ${url}`);
    const startTime = Date.now();

    // ✅ CORRECTION: Timeout pour éviter les DoS
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes max

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // ✅ CORRECTION: Limiter la taille de la réponse (5MB max)
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
        throw new Error("Response too large");
      }

      const html = await response.text();

      // ... reste du code d'extraction inchangé

    } catch (fetchError: any) {
      if (fetchError.name === "AbortError") {
        return NextResponse.json({ error: "Timeout - URL trop lente" }, { status: 408 });
      }
      throw fetchError;
    }

  } catch (error: unknown) {
    return handleApiError(error);
  }
}
```

---

### 1.3 [SEC-003] Ajouter authentification à /api/revalidate

#### Fichier : `/app/api/revalidate/route.ts`

**Remplacer le contenu par** :

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route API pour forcer la revalidation du cache Next.js
 * ✅ CORRECTION SEC-003: Authentification admin requise
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, handleApiError } from "@/lib/helpers/api-error";

export async function POST(request: Request) {
  try {
    // ✅ CORRECTION: Authentification requise
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, "Authentification requise");
    }

    // ✅ CORRECTION: Vérifier le rôle admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      throw new ApiError(403, "Accès réservé aux administrateurs");
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    const tag = searchParams.get("tag");

    // ✅ CORRECTION: Validation des inputs
    if (path) {
      // Valider que le path commence par /
      if (!path.startsWith("/")) {
        throw new ApiError(400, "Le path doit commencer par /");
      }
      revalidatePath(path);
      console.log(`[revalidate] Path revalidated by ${user.email}: ${path}`);
    }

    if (tag) {
      // Valider le format du tag (alphanumeric + : + -)
      if (!/^[a-zA-Z0-9:_-]+$/.test(tag)) {
        throw new ApiError(400, "Format de tag invalide");
      }
      revalidateTag(tag);
      console.log(`[revalidate] Tag revalidated by ${user.email}: ${tag}`);
    }

    // Tags standards si aucun spécifié
    if (!tag && !path) {
      const standardTags = [
        "owner:properties",
        "admin:properties",
        "owner:leases",
        "owner:dashboard",
      ];
      standardTags.forEach((t) => revalidateTag(t));
      console.log(`[revalidate] Standard tags revalidated by ${user.email}`);
    }

    return NextResponse.json({
      success: true,
      revalidated: { path, tag },
      timestamp: Date.now(),
      by: user.email,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
```

---

### 1.4 [SEC-004] Chiffrer les secrets 2FA

#### Fichier : `/app/api/auth/2fa/enable/route.ts`

**Modifications à apporter** :

```typescript
import { encryptKey, decryptKey } from "@/lib/helpers/encryption";
import { setupTOTP, generateRecoveryCodes } from "@/lib/auth/totp";

// Dans la fonction POST, remplacer le stockage du secret :

export async function POST(request: Request) {
  try {
    // ... code d'authentification existant ...

    const setup = setupTOTP(user.email!);
    const recoveryCodes = generateRecoveryCodes();

    // ✅ CORRECTION SEC-004: Chiffrer le secret 2FA avant stockage
    const encryptedSecret = encryptKey(setup.secret);

    // ✅ CORRECTION: Chiffrer aussi les codes de récupération
    const encryptedRecoveryCodes = recoveryCodes.map((code) => ({
      ...code,
      code: encryptKey(code.code),
    }));

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        two_factor_secret: encryptedSecret, // ✅ Chiffré
        two_factor_recovery_codes: encryptedRecoveryCodes, // ✅ Chiffrés
        two_factor_pending: true,
      })
      .eq("user_id", user.id);

    if (updateError) {
      throw new ApiError(500, "Erreur lors de la configuration 2FA");
    }

    return NextResponse.json({
      success: true,
      qrCodeUrl: setup.qrCodeUrl,
      secret: setup.secret, // ✅ Retourné en clair pour affichage unique
      recoveryCodes: recoveryCodes.map((c) => c.code), // ✅ Retournés en clair pour affichage unique
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### Fichier : `/app/api/auth/2fa/verify/route.ts`

**Modifications pour déchiffrer** :

```typescript
import { decryptKey } from "@/lib/helpers/encryption";
import { verifyTOTPCode } from "@/lib/auth/totp";

export async function POST(request: Request) {
  try {
    // ... code existant pour récupérer le profil ...

    const { data: profile } = await supabase
      .from("profiles")
      .select("two_factor_secret, two_factor_pending")
      .eq("user_id", user.id)
      .single();

    if (!profile?.two_factor_secret) {
      throw new ApiError(400, "2FA non configuré");
    }

    // ✅ CORRECTION: Déchiffrer le secret avant vérification
    const decryptedSecret = decryptKey(profile.two_factor_secret);

    const { code } = await request.json();
    const isValid = verifyTOTPCode(decryptedSecret, code);

    if (!isValid) {
      throw new ApiError(400, "Code invalide");
    }

    // ... reste du code ...
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

### 1.5 [SEC-005] Implémenter Rate Limiting Redis

#### Fichier : `/lib/middleware/rate-limit.ts` (REMPLACEMENT COMPLET)

```typescript
/**
 * Rate Limiting avec Upstash Redis
 * ✅ CORRECTION SEC-005: Rate limiting distribué et persistant
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ✅ Configuration Redis (Upstash)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ✅ Fallback en mémoire si Redis non configuré (dev uniquement)
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// ✅ Rate limiters par preset (utilisent Redis)
const rateLimiters = {
  payment: isRedisConfigured()
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 req/minute
        analytics: true,
        prefix: "ratelimit:payment",
      })
    : null,

  auth: isRedisConfigured()
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 req/15min
        analytics: true,
        prefix: "ratelimit:auth",
      })
    : null,

  signup: isRedisConfigured()
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 req/heure
        analytics: true,
        prefix: "ratelimit:signup",
      })
    : null,

  api: isRedisConfigured()
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"), // 60 req/minute
        analytics: true,
        prefix: "ratelimit:api",
      })
    : null,

  scrape: isRedisConfigured()
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 req/minute
        analytics: true,
        prefix: "ratelimit:scrape",
      })
    : null,

  sms: isRedisConfigured()
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 m"), // 3 req/minute
        analytics: true,
        prefix: "ratelimit:sms",
      })
    : null,

  export: isRedisConfigured()
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "5 m"), // 5 req/5min
        analytics: true,
        prefix: "ratelimit:export",
      })
    : null,
};

export type RateLimitPreset = keyof typeof rateLimiters;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

/**
 * Fallback en mémoire pour le développement
 */
function inMemoryRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const record = inMemoryStore.get(key);

  // Nettoyer les entrées expirées
  if (record && record.resetAt < now) {
    inMemoryStore.delete(key);
  }

  const current = inMemoryStore.get(key);

  if (!current) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      reset: now + windowMs,
      limit: maxRequests,
    };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      reset: current.resetAt,
      limit: maxRequests,
    };
  }

  current.count++;
  return {
    allowed: true,
    remaining: maxRequests - current.count,
    reset: current.resetAt,
    limit: maxRequests,
  };
}

// ✅ Presets de configuration (pour fallback en mémoire)
const presetConfigs: Record<RateLimitPreset, { maxRequests: number; windowMs: number }> = {
  payment: { maxRequests: 5, windowMs: 60 * 1000 },
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  signup: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  api: { maxRequests: 60, windowMs: 60 * 1000 },
  scrape: { maxRequests: 10, windowMs: 60 * 1000 },
  sms: { maxRequests: 3, windowMs: 60 * 1000 },
  export: { maxRequests: 5, windowMs: 5 * 60 * 1000 },
};

/**
 * Appliquer le rate limiting à une requête
 * @returns null si autorisé, Response 429 sinon
 */
export async function applyRateLimit(
  request: Request,
  preset: RateLimitPreset,
  identifier?: string
): Promise<Response | null> {
  const key =
    identifier ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const limiter = rateLimiters[preset];
  let result: RateLimitResult;

  if (limiter) {
    // ✅ Utiliser Redis (production)
    const { success, remaining, reset, limit } = await limiter.limit(key);
    result = {
      allowed: success,
      remaining,
      reset,
      limit,
    };
  } else {
    // ⚠️ Fallback en mémoire (développement uniquement)
    if (process.env.NODE_ENV === "production") {
      console.warn(
        `[RateLimit] Redis not configured for preset '${preset}'. ` +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
      );
    }
    const config = presetConfigs[preset];
    result = inMemoryRateLimit(`${preset}:${key}`, config.maxRequests, config.windowMs);
  }

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    return new Response(
      JSON.stringify({
        error: "Trop de requêtes. Veuillez réessayer plus tard.",
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": result.limit.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": result.reset.toString(),
          "Retry-After": retryAfter.toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Middleware wrapper pour les routes API
 */
export function withRateLimit(
  preset: RateLimitPreset,
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const rateLimitResponse = await applyRateLimit(request, preset);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(request);
  };
}
```

#### Variables d'environnement requises :

```bash
# .env.local
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx
```

---

### 1.6 [DATA-001] Corriger la limite de 20 propriétés

#### Fichier : `/app/api/owner/properties/route.ts`

**Modifier la fonction `fetchPropertyMedia`** :

```typescript
/**
 * Récupère les médias (photos) pour les propriétés
 * ✅ CORRECTION DATA-001: Pagination au lieu de limite arbitraire
 */
async function fetchPropertyMedia(
  propertyIds: string[]
): Promise<Map<string, { cover_url: string | null; cover_document_id: string | null; documents_count: number }>> {
  const result = new Map<string, { cover_url: string | null; cover_document_id: string | null; documents_count: number }>();

  if (propertyIds.length === 0) {
    return result;
  }

  // ✅ CORRECTION: Traiter par lots de 50 au lieu de limiter à 20
  const BATCH_SIZE = 50;
  const batches: string[][] = [];

  for (let i = 0; i < propertyIds.length; i += BATCH_SIZE) {
    batches.push(propertyIds.slice(i, i + BATCH_SIZE));
  }

  try {
    const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
    const serviceClient = supabaseAdmin();

    // ✅ CORRECTION: Traiter chaque lot
    for (const batch of batches) {
      // Photos
      try {
        const { data: photos, error: photosError } = await serviceClient
          .from("photos")
          .select("id, property_id, url, is_main, ordre")
          .in("property_id", batch)
          .order("is_main", { ascending: false })
          .order("ordre", { ascending: true });

        if (!photosError && photos && photos.length > 0) {
          photos.forEach((photo: any) => {
            if (!photo.property_id) return;
            const current = result.get(photo.property_id) ?? {
              cover_url: null,
              cover_document_id: null,
              documents_count: 0,
            };
            current.documents_count += 1;
            if (photo.is_main || (!current.cover_url && current.documents_count === 1)) {
              current.cover_document_id = photo.id ?? null;
              current.cover_url = photo.url ?? null;
            }
            result.set(photo.property_id, current);
          });
        }
      } catch (err: any) {
        console.warn("[fetchPropertyMedia] Batch photos error:", err?.message);
      }

      // Documents (fallback) - seulement pour les propriétés sans photos
      const propertiesWithoutMedia = batch.filter(
        (id) => !result.has(id) || !result.get(id)?.cover_url
      );

      if (propertiesWithoutMedia.length > 0) {
        try {
          const { data: documents } = await serviceClient
            .from("documents")
            .select("id, property_id, preview_url, is_cover, created_at")
            .in("property_id", propertiesWithoutMedia)
            .eq("collection", "property_media")
            .order("is_cover", { ascending: false })
            .order("created_at", { ascending: false });

          if (documents && documents.length > 0) {
            documents.forEach((doc: any) => {
              if (!doc.property_id) return;
              const current = result.get(doc.property_id) ?? {
                cover_url: null,
                cover_document_id: null,
                documents_count: 0,
              };
              current.documents_count += 1;
              if ((doc.is_cover || current.documents_count === 1) && !current.cover_url) {
                current.cover_document_id = doc.id ?? null;
                current.cover_url = doc.preview_url ?? null;
              }
              result.set(doc.property_id, current);
            });
          }
        } catch (err: any) {
          console.warn("[fetchPropertyMedia] Batch documents error:", err?.message);
        }
      }
    }

    // ✅ Log si beaucoup de propriétés
    if (propertyIds.length > 100) {
      console.log(
        `[fetchPropertyMedia] Processed ${propertyIds.length} properties in ${batches.length} batches`
      );
    }

  } catch (error: any) {
    console.error("[fetchPropertyMedia] Critical error:", error?.message);
  }

  return result;
}
```

---

### 1.7 [DATA-002] Auto-save pour le formulaire de bail

#### Fichier : `/features/leases/hooks/use-lease-draft.ts` (NOUVEAU)

```typescript
/**
 * Hook pour gérer les brouillons de bail avec auto-save
 * ✅ CORRECTION DATA-002: Persistance locale + debounce
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface LeaseDraftData {
  property_id: string | null;
  unit_id: string | null;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  depot_de_garantie: number;
  date_debut: string;
  date_fin: string | null;
  tenant_email: string;
  tenant_name: string;
}

const STORAGE_KEY = "talok:lease-draft";
const DEBOUNCE_MS = 1000;

interface UseLeaseDraftOptions {
  propertyId?: string;
  initialData?: Partial<LeaseDraftData>;
  onRestore?: () => void;
}

export function useLeaseDraft(options: UseLeaseDraftOptions = {}) {
  const { propertyId, initialData, onRestore } = options;

  const [formData, setFormData] = useState<LeaseDraftData>(() => {
    // Tenter de restaurer depuis localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Vérifier que le brouillon correspond à la même propriété
          if (!propertyId || parsed.property_id === propertyId) {
            onRestore?.();
            return { ...getDefaultData(), ...parsed, ...initialData };
          }
        } catch {}
      }
    }
    return { ...getDefaultData(), property_id: propertyId || null, ...initialData };
  });

  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const isInitialMount = useRef(true);

  // Debounce pour auto-save
  const debouncedFormData = useDebounce(formData, DEBOUNCE_MS);

  // Sauvegarder dans localStorage quand les données changent (debounced)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(debouncedFormData));
      setLastSaved(new Date());
      setIsDirty(false);
    }
  }, [debouncedFormData]);

  // Avertir avant de quitter si données non sauvegardées
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "Vous avez des modifications non sauvegardées.";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const updateField = useCallback(<K extends keyof LeaseDraftData>(
    field: K,
    value: LeaseDraftData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const updateFields = useCallback((updates: Partial<LeaseDraftData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  const clearDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    setFormData(getDefaultData());
    setIsDirty(false);
    setLastSaved(null);
  }, []);

  const hasDraft = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(STORAGE_KEY);
  }, []);

  return {
    formData,
    setFormData,
    updateField,
    updateFields,
    clearDraft,
    hasDraft,
    isDirty,
    lastSaved,
  };
}

function getDefaultData(): LeaseDraftData {
  return {
    property_id: null,
    unit_id: null,
    type_bail: "nu",
    loyer: 0,
    charges_forfaitaires: 0,
    depot_de_garantie: 0,
    date_debut: "",
    date_fin: null,
    tenant_email: "",
    tenant_name: "",
  };
}
```

#### Modifier `/features/leases/components/lease-form.tsx` :

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Clock } from "lucide-react";
import { leasesService } from "../services/leases.service";
import { propertiesService } from "@/features/properties/services/properties.service";
import { useLeaseDraft } from "../hooks/use-lease-draft"; // ✅ NOUVEAU
import type { Lease, Property, LeaseType } from "@/lib/types";
import { useAuth } from "@/lib/hooks/use-auth";
import { getMaxDepotLegal, getMaxDepotMois } from "@/lib/validations/lease-financial";

interface LeaseFormProps {
  propertyId?: string;
  lease?: Lease;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function LeaseForm({ propertyId, lease, onSuccess, onCancel }: LeaseFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [restoredDraft, setRestoredDraft] = useState(false);

  // ✅ CORRECTION DATA-002: Utiliser le hook de brouillon
  const {
    formData,
    updateField,
    updateFields,
    clearDraft,
    isDirty,
    lastSaved,
  } = useLeaseDraft({
    propertyId,
    initialData: lease ? {
      property_id: lease.property_id,
      unit_id: lease.unit_id,
      type_bail: lease.type_bail,
      loyer: lease.loyer,
      charges_forfaitaires: lease.charges_forfaitaires,
      depot_de_garantie: lease.depot_de_garantie,
      date_debut: lease.date_debut,
      date_fin: lease.date_fin,
    } : undefined,
    onRestore: () => {
      setRestoredDraft(true);
      toast({
        title: "Brouillon restauré",
        description: "Vos modifications précédentes ont été récupérées.",
      });
    },
  });

  useEffect(() => {
    if (profile) {
      propertiesService
        .getPropertiesByOwner(profile.id)
        .then(setProperties)
        .catch(() => {});
    }
  }, [profile]);

  // Calcul automatique du dépôt de garantie
  useEffect(() => {
    if (formData.loyer > 0) {
      const depotAuto = getMaxDepotLegal(formData.type_bail as LeaseType, formData.loyer);
      updateField("depot_de_garantie", depotAuto);
    }
  }, [formData.loyer, formData.type_bail, updateField]);

  const depotMois = useMemo(() => getMaxDepotMois(formData.type_bail as LeaseType), [formData.type_bail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (lease) {
        await leasesService.updateLease(lease.id, formData);
        toast({
          title: "Bail mis à jour",
          description: "Les modifications ont été enregistrées.",
        });
      } else {
        await leasesService.createLease(formData);
        toast({
          title: "Bail créé",
          description: "Le bail a été créé avec succès.",
        });
      }

      // ✅ Nettoyer le brouillon après succès
      clearDraft();
      onSuccess?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{lease ? "Modifier le bail" : "Nouveau bail"}</CardTitle>
            <CardDescription>
              {lease ? "Modifiez les informations du bail" : "Créez un nouveau bail de location"}
            </CardDescription>
          </div>

          {/* ✅ NOUVEAU: Indicateur de sauvegarde */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isDirty ? (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                Modifications en cours...
              </Badge>
            ) : lastSaved ? (
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                Sauvegardé
              </Badge>
            ) : null}
          </div>
        </div>

        {/* ✅ NOUVEAU: Notification de brouillon restauré */}
        {restoredDraft && !lease && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <AlertCircle className="h-4 w-4" />
            <span>Brouillon restauré.</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-blue-700 dark:text-blue-300"
              onClick={() => {
                clearDraft();
                setRestoredDraft(false);
                window.location.reload();
              }}
            >
              Recommencer à zéro
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ... reste du formulaire avec updateField au lieu de setFormData ... */}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="property_id">Logement</Label>
              <select
                id="property_id"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.property_id || ""}
                onChange={(e) =>
                  updateFields({
                    property_id: e.target.value || null,
                    unit_id: null,
                  })
                }
                required={!formData.unit_id}
                disabled={loading || !!propertyId}
              >
                <option value="">Sélectionner un logement</option>
                {properties.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.adresse_complete} ({prop.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type_bail">Type de bail</Label>
              <select
                id="type_bail"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.type_bail}
                onChange={(e) => updateField("type_bail", e.target.value)}
                required
                disabled={loading}
              >
                <option value="nu">Bail nu</option>
                <option value="meuble">Bail meublé</option>
                <option value="colocation">Colocation</option>
                <option value="saisonnier">Saisonnier</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="loyer">Loyer mensuel (€)</Label>
              <Input
                id="loyer"
                type="number"
                min="0"
                step="0.01"
                value={formData.loyer}
                onChange={(e) => updateField("loyer", parseFloat(e.target.value) || 0)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="charges_forfaitaires">Charges forfaitaires (€)</Label>
              <Input
                id="charges_forfaitaires"
                type="number"
                min="0"
                step="0.01"
                value={formData.charges_forfaitaires}
                onChange={(e) => updateField("charges_forfaitaires", parseFloat(e.target.value) || 0)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="depot_de_garantie">
                Dépôt de garantie (€)
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {depotMois > 0 ? `(${depotMois} mois - auto)` : "(interdit)"}
                </span>
              </Label>
              <Input
                id="depot_de_garantie"
                type="number"
                min="0"
                step="0.01"
                value={formData.depot_de_garantie}
                readOnly
                className="bg-muted cursor-not-allowed"
                disabled={loading}
              />
            </div>
          </div>

          {/* Section Locataire */}
          {!lease && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium text-sm text-muted-foreground">Locataire (optionnel)</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tenant_name">Nom complet du locataire</Label>
                  <Input
                    id="tenant_name"
                    type="text"
                    placeholder="Jean Dupont"
                    value={formData.tenant_name || ""}
                    onChange={(e) => updateField("tenant_name", e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant_email">Email du locataire</Label>
                  <Input
                    id="tenant_email"
                    type="email"
                    placeholder="locataire@email.com"
                    value={formData.tenant_email || ""}
                    onChange={(e) => updateField("tenant_email", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date_debut">Date de début</Label>
              <Input
                id="date_debut"
                type="date"
                value={formData.date_debut}
                onChange={(e) => updateField("date_debut", e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_fin">Date de fin (optionnel)</Label>
              <Input
                id="date_fin"
                type="date"
                value={formData.date_fin || ""}
                onChange={(e) => updateField("date_fin", e.target.value || null)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : lease ? "Modifier" : "Créer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

---

### 1.8 [SEC-006] Corriger le bypass webhook signature

#### Fichier : `/app/api/signatures/webhook/route.ts`

**Modifier la fonction `verifyWebhookSignature`** :

```typescript
/**
 * Vérifie la signature HMAC du webhook Yousign
 * ✅ CORRECTION SEC-006: Fail-safe en production
 */
function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.YOUSIGN_WEBHOOK_SECRET;

  // ✅ CORRECTION: Toujours rejeter en production si secret manquant
  if (!secret) {
    console.error("[Webhook] YOUSIGN_WEBHOOK_SECRET non configuré");

    if (process.env.NODE_ENV === "production") {
      // En production, TOUJOURS rejeter
      return false;
    }

    // En développement, avertir mais permettre
    console.warn("[Webhook] ⚠️ DEV MODE: Signature verification skipped (no secret)");
    return true;
  }

  if (!signature) {
    console.error("[Webhook] Signature manquante dans les headers");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      console.error("[Webhook] Signature length mismatch");
      return false;
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      console.error("[Webhook] Signature verification failed");
    }

    return isValid;
  } catch (error) {
    console.error("[Webhook] Erreur lors de la vérification de signature:", error);
    return false;
  }
}
```

---

## 2. CORRECTIONS IMPORTANTES (P1)

### 2.1 [SEC-007] Génération sécurisée des codes de récupération

#### Fichier : `/lib/auth/totp.ts`

**Modifier la fonction `generateRecoveryCodes`** :

```typescript
import { randomBytes } from "crypto";

/**
 * Génère des codes de récupération (backup codes)
 * ✅ CORRECTION SEC-007: Utiliser crypto.randomBytes au lieu de Math.random()
 */
export function generateRecoveryCodes(count: number = 10): RecoveryCode[] {
  const codes: RecoveryCode[] = [];

  for (let i = 0; i < count; i++) {
    // ✅ CORRECTION: Génération cryptographiquement sécurisée
    const bytes = randomBytes(9); // 9 bytes = 72 bits d'entropie
    const code = bytes
      .toString("base64")
      .replace(/[+/=]/g, "") // Supprimer caractères ambigus
      .substring(0, 12)      // 12 caractères
      .toUpperCase()
      .match(/.{4}/g)        // Grouper par 4
      ?.join("-") || "";     // Format: XXXX-XXXX-XXXX

    codes.push({
      code,
      used: false,
    });
  }

  return codes;
}
```

---

### 2.2 [DATA-003] Synchroniser Real-time avec React Query

#### Fichier : `/lib/hooks/use-realtime-sync.ts` (NOUVEAU)

```typescript
/**
 * Hook pour synchroniser les events real-time avec React Query
 * ✅ CORRECTION DATA-003
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type TableName = "leases" | "properties" | "invoices" | "payments" | "tickets";

interface UseRealtimeSyncOptions {
  table: TableName;
  filter?: { column: string; value: string };
  queryKeys: string[][];
}

export function useRealtimeSync(options: UseRealtimeSyncOptions) {
  const { table, filter, queryKeys } = options;
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const channelName = filter
      ? `sync-${table}-${filter.column}-${filter.value}`
      : `sync-${table}`;

    let channel = supabase.channel(channelName);

    // Construire le filtre
    const filterConfig = filter
      ? { event: "*" as const, schema: "public", table, filter: `${filter.column}=eq.${filter.value}` }
      : { event: "*" as const, schema: "public", table };

    channel = channel.on(
      "postgres_changes",
      filterConfig,
      (payload: RealtimePostgresChangesPayload<any>) => {
        console.log(`[RealtimeSync] ${table} ${payload.eventType}`, payload);

        // Invalider les query keys concernées
        queryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });

        // Optionnel: Mise à jour optimiste pour INSERT/UPDATE
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const newRecord = payload.new;

          queryKeys.forEach((key) => {
            queryClient.setQueryData(key, (old: any[] | undefined) => {
              if (!old || !Array.isArray(old)) return old;

              if (payload.eventType === "INSERT") {
                return [...old, newRecord];
              }

              // UPDATE: remplacer l'enregistrement
              return old.map((item) =>
                item.id === newRecord.id ? { ...item, ...newRecord } : item
              );
            });
          });
        }

        // Pour DELETE, retirer l'élément
        if (payload.eventType === "DELETE") {
          const deletedId = payload.old?.id;

          queryKeys.forEach((key) => {
            queryClient.setQueryData(key, (old: any[] | undefined) => {
              if (!old || !Array.isArray(old)) return old;
              return old.filter((item) => item.id !== deletedId);
            });
          });
        }
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter?.column, filter?.value, queryClient, supabase]);
}

/**
 * Hook pour synchroniser les leases
 */
export function useRealtimeLeasesSync(ownerId: string) {
  useRealtimeSync({
    table: "leases",
    queryKeys: [
      ["leases"],
      ["leases", ownerId],
      ["owner-dashboard"],
      ["dashboard"],
    ],
  });
}

/**
 * Hook pour synchroniser les propriétés
 */
export function useRealtimePropertiesSync(ownerId: string) {
  useRealtimeSync({
    table: "properties",
    filter: { column: "owner_id", value: ownerId },
    queryKeys: [
      ["properties"],
      ["properties", ownerId],
      ["owner-dashboard"],
    ],
  });
}

/**
 * Hook pour synchroniser les factures
 */
export function useRealtimeInvoicesSync(ownerId: string) {
  useRealtimeSync({
    table: "invoices",
    queryKeys: [
      ["invoices"],
      ["invoices", ownerId],
      ["owner-dashboard"],
      ["dashboard"],
    ],
  });
}
```

---

### 2.3 [DATA-004] Améliorer l'invalidation de cache

#### Fichier : `/lib/hooks/use-cache-invalidation.ts` (NOUVEAU)

```typescript
/**
 * Utilitaires centralisés pour l'invalidation de cache
 * ✅ CORRECTION DATA-004
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

type EntityType = "property" | "lease" | "invoice" | "payment" | "ticket" | "document";

/**
 * Relations entre entités pour l'invalidation en cascade
 */
const RELATED_QUERIES: Record<EntityType, string[][]> = {
  property: [
    ["properties"],
    ["leases"],
    ["owner-dashboard"],
    ["dashboard"],
  ],
  lease: [
    ["leases"],
    ["properties"], // Active lease count
    ["invoices"],
    ["owner-dashboard"],
    ["dashboard"],
  ],
  invoice: [
    ["invoices"],
    ["payments"],
    ["leases"],
    ["owner-dashboard"],
    ["dashboard"],
  ],
  payment: [
    ["payments"],
    ["invoices"],
    ["owner-dashboard"],
    ["dashboard"],
  ],
  ticket: [
    ["tickets"],
    ["properties"],
    ["owner-dashboard"],
  ],
  document: [
    ["documents"],
    ["properties"],
    ["leases"],
  ],
};

export function useCacheInvalidation() {
  const queryClient = useQueryClient();

  /**
   * Invalider toutes les requêtes liées à une entité
   */
  const invalidateEntity = useCallback(
    (entity: EntityType, id?: string) => {
      const relatedKeys = RELATED_QUERIES[entity] || [];

      // Invalider la requête spécifique si ID fourni
      if (id) {
        queryClient.invalidateQueries({ queryKey: [entity, id] });
      }

      // Invalider les requêtes liées
      relatedKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    [queryClient]
  );

  /**
   * Invalider après création
   */
  const onEntityCreated = useCallback(
    (entity: EntityType, id: string) => {
      console.log(`[Cache] Entity created: ${entity}/${id}`);
      invalidateEntity(entity);
    },
    [invalidateEntity]
  );

  /**
   * Invalider après mise à jour
   */
  const onEntityUpdated = useCallback(
    (entity: EntityType, id: string) => {
      console.log(`[Cache] Entity updated: ${entity}/${id}`);
      invalidateEntity(entity, id);
    },
    [invalidateEntity]
  );

  /**
   * Invalider après suppression
   */
  const onEntityDeleted = useCallback(
    (entity: EntityType, id: string) => {
      console.log(`[Cache] Entity deleted: ${entity}/${id}`);

      // Supprimer immédiatement du cache
      queryClient.removeQueries({ queryKey: [entity, id] });

      // Invalider les listes
      invalidateEntity(entity);
    },
    [queryClient, invalidateEntity]
  );

  /**
   * Invalider tout le dashboard
   */
  const invalidateDashboard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["tenant-dashboard"] });
  }, [queryClient]);

  return {
    invalidateEntity,
    onEntityCreated,
    onEntityUpdated,
    onEntityDeleted,
    invalidateDashboard,
  };
}
```

---

### 2.4 [INTEG-001] Système de retry pour webhooks

#### Fichier : `/lib/services/webhook-retry.service.ts` (NOUVEAU)

```typescript
/**
 * Service de retry pour les webhooks échoués
 * ✅ CORRECTION INTEG-001
 */

import { createClient } from "@/lib/supabase/server";

interface WebhookLog {
  id: string;
  provider: string;
  event_type: string;
  event_id: string;
  payload: any;
  status: "pending" | "processing" | "success" | "failed" | "retrying";
  attempts: number;
  last_error?: string;
  created_at: string;
  processed_at?: string;
  next_retry_at?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [60, 300, 900]; // 1min, 5min, 15min

export async function logWebhook(
  provider: string,
  eventType: string,
  eventId: string,
  payload: any,
  status: "success" | "failed",
  error?: string
): Promise<void> {
  const supabase = await createClient();

  await supabase.from("webhook_logs").insert({
    provider,
    event_type: eventType,
    event_id: eventId,
    payload,
    status,
    attempts: 1,
    last_error: error,
    processed_at: status === "success" ? new Date().toISOString() : null,
    next_retry_at:
      status === "failed"
        ? new Date(Date.now() + RETRY_DELAYS[0] * 1000).toISOString()
        : null,
  });
}

export async function scheduleRetry(webhookId: string): Promise<void> {
  const supabase = await createClient();

  const { data: webhook } = await supabase
    .from("webhook_logs")
    .select("*")
    .eq("id", webhookId)
    .single();

  if (!webhook || webhook.attempts >= MAX_RETRIES) {
    // Marquer comme échoué définitivement
    await supabase
      .from("webhook_logs")
      .update({ status: "failed" })
      .eq("id", webhookId);
    return;
  }

  const nextDelay = RETRY_DELAYS[webhook.attempts] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

  await supabase
    .from("webhook_logs")
    .update({
      status: "retrying",
      attempts: webhook.attempts + 1,
      next_retry_at: new Date(Date.now() + nextDelay * 1000).toISOString(),
    })
    .eq("id", webhookId);
}

export async function processFailedWebhooks(): Promise<number> {
  const supabase = await createClient();

  const { data: pendingWebhooks } = await supabase
    .from("webhook_logs")
    .select("*")
    .in("status", ["failed", "retrying"])
    .lt("next_retry_at", new Date().toISOString())
    .lt("attempts", MAX_RETRIES)
    .limit(10);

  if (!pendingWebhooks?.length) return 0;

  let processed = 0;

  for (const webhook of pendingWebhooks) {
    try {
      // Marquer comme en cours
      await supabase
        .from("webhook_logs")
        .update({ status: "processing" })
        .eq("id", webhook.id);

      // Re-traiter le webhook
      await reprocessWebhook(webhook);

      // Marquer comme succès
      await supabase
        .from("webhook_logs")
        .update({
          status: "success",
          processed_at: new Date().toISOString(),
        })
        .eq("id", webhook.id);

      processed++;
    } catch (error: any) {
      // Planifier un nouveau retry
      await supabase
        .from("webhook_logs")
        .update({
          status: "retrying",
          last_error: error.message,
          next_retry_at: new Date(
            Date.now() + RETRY_DELAYS[Math.min(webhook.attempts, RETRY_DELAYS.length - 1)] * 1000
          ).toISOString(),
        })
        .eq("id", webhook.id);
    }
  }

  return processed;
}

async function reprocessWebhook(webhook: WebhookLog): Promise<void> {
  // Importer dynamiquement le handler approprié
  switch (webhook.provider) {
    case "stripe": {
      const { processStripeEvent } = await import("@/app/api/webhooks/stripe/handlers");
      await processStripeEvent(webhook.payload);
      break;
    }
    case "yousign": {
      const { processSignatureEvent } = await import("@/app/api/signatures/webhook/handlers");
      await processSignatureEvent(webhook.payload);
      break;
    }
    default:
      throw new Error(`Unknown provider: ${webhook.provider}`);
  }
}
```

---

## 3. AMÉLIORATIONS BACKLOG (P2)

### 3.1 Migration SQL pour webhook_logs

```sql
-- Migration: Ajouter champs retry aux webhook_logs
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Index pour les requêtes de retry
CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry
ON webhook_logs (status, next_retry_at)
WHERE status IN ('failed', 'retrying');

-- Fonction de nettoyage (garder 30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND status = 'success';
END;
$$ LANGUAGE plpgsql;
```

---

## 4. PLAN D'IMPLÉMENTATION

### Sprint 1 (Immédiat) - 2 jours

| Jour | Tâche | Fichiers | Effort |
|------|-------|----------|--------|
| J1 AM | SEC-001: Secrets | encryption.ts, csrf.ts, env-validation.ts | 2h |
| J1 PM | SEC-002: SSRF | scrape/route.ts | 2h |
| J1 PM | SEC-003: Revalidate auth | revalidate/route.ts | 30min |
| J2 AM | SEC-004: 2FA chiffré | 2fa/enable, 2fa/verify | 2h |
| J2 AM | SEC-006: Webhook bypass | signatures/webhook | 30min |
| J2 PM | SEC-005: Redis rate limit | rate-limit.ts | 3h |
| J2 PM | DATA-001: Limite 20 props | owner/properties | 1h |

### Sprint 2 (1 semaine)

| Jour | Tâche | Fichiers | Effort |
|------|-------|----------|--------|
| J1 | DATA-002: Auto-save bail | lease-form.tsx, use-lease-draft.ts | 4h |
| J2 | SEC-007: Recovery codes | totp.ts | 1h |
| J2-J3 | DATA-003: Realtime sync | use-realtime-sync.ts | 6h |
| J3-J4 | DATA-004: Cache invalidation | use-cache-invalidation.ts | 4h |
| J4-J5 | INTEG-001: Webhook retry | webhook-retry.service.ts | 6h |

---

## 5. TESTS & VALIDATION

### Tests unitaires requis

```typescript
// tests/security/encryption.test.ts
describe("Encryption", () => {
  it("should throw if API_KEY_MASTER_KEY is missing", () => {
    delete process.env.API_KEY_MASTER_KEY;
    expect(() => encryptKey("test")).toThrow();
  });

  it("should encrypt and decrypt correctly", () => {
    process.env.API_KEY_MASTER_KEY = "test-key-with-32-characters-here";
    const original = "my-secret-api-key";
    const encrypted = encryptKey(original);
    const decrypted = decryptKey(encrypted);
    expect(decrypted).toBe(original);
  });
});

// tests/security/rate-limit.test.ts
describe("Rate Limiting", () => {
  it("should block after max requests", async () => {
    for (let i = 0; i < 5; i++) {
      const result = await applyRateLimit(mockRequest, "auth", "test-user");
      expect(result).toBeNull();
    }
    const blocked = await applyRateLimit(mockRequest, "auth", "test-user");
    expect(blocked?.status).toBe(429);
  });
});
```

---

## 6. CHECKLIST DE DÉPLOIEMENT

### Avant déploiement

- [ ] Toutes les variables d'environnement configurées
- [ ] `API_KEY_MASTER_KEY` (32+ caractères)
- [ ] `CSRF_SECRET` (32+ caractères)
- [ ] `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`
- [ ] `YOUSIGN_WEBHOOK_SECRET`
- [ ] `CRON_SECRET`
- [ ] Tests passent en local
- [ ] Build Next.js réussit
- [ ] Migration BDD webhook_logs appliquée

### Après déploiement

- [ ] Tester /api/scrape (doit rejeter URLs internes)
- [ ] Tester /api/revalidate (doit demander auth admin)
- [ ] Vérifier logs rate limiting Redis
- [ ] Tester formulaire bail (auto-save)
- [ ] Vérifier webhooks Stripe/Yousign

---

**Fin du guide d'améliorations détaillé**
