/**
 * Service centralisé pour récupérer les credentials des API externes
 * 
 * Récupère les clés depuis la base de données (configurées via Admin > Intégrations)
 * ou utilise les variables d'environnement en fallback
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * Crée un client Supabase avec le service role key (bypass RLS)
 * Nécessaire pour accéder aux tables api_providers et api_credentials
 */
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase URL or service role key");
  }
  
  return createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// Types
export type ProviderName =
  | "Resend"
  | "Twilio"
  | "Stripe"
  | "Veriff"
  | "GoCardless"
  | "Google Maps"
  | "Brevo"
  | "SendGrid";

export interface ProviderCredentials {
  apiKey: string;
  config: Record<string, string>;
  env: string;
}

// Cache pour éviter les appels répétés
const credentialsCache = new Map<string, { data: ProviderCredentials | null; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Déchiffre une clé API chiffrée avec AES-256-GCM
 */
function decryptKey(encryptedKey: string): string {
  const masterKey = process.env.API_KEY_MASTER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "default-key-for-dev-only-32chars!";
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(masterKey, "external-api-salt", 32);
  
  const parts = encryptedKey.split(":");
  if (parts.length !== 3) {
    throw new Error("Format de clé chiffrée invalide");
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Récupère les credentials d'un provider depuis la DB
 */
export async function getProviderCredentials(
  providerName: ProviderName,
  preferredEnv: "prod" | "dev" = "prod"
): Promise<ProviderCredentials | null> {
  // Vérifier le cache
  const cacheKey = `${providerName}:${preferredEnv}`;
  const cached = credentialsCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    // Utiliser le service client pour bypass RLS
    const supabase = getServiceClient();
    
    // Récupérer le provider
    const { data: provider, error: providerError } = await supabase
      .from("api_providers")
      .select("id, status")
      .eq("name", providerName)
      .single();

    if (providerError || !provider) {
      console.warn(`[Credentials] Provider ${providerName} non trouvé`);
      credentialsCache.set(cacheKey, { data: null, expires: Date.now() + CACHE_TTL });
      return null;
    }

    if (provider.status !== "active") {
      console.warn(`[Credentials] Provider ${providerName} inactif`);
      credentialsCache.set(cacheKey, { data: null, expires: Date.now() + CACHE_TTL });
      return null;
    }

    // Récupérer les credentials (préférer l'env demandé, sinon prendre le premier disponible)
    const { data: credentials, error: credError } = await supabase
      .from("api_credentials")
      .select("secret_ref, scope, env")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false });

    if (credError || !credentials || credentials.length === 0) {
      console.warn(`[Credentials] Aucune credential pour ${providerName}`);
      credentialsCache.set(cacheKey, { data: null, expires: Date.now() + CACHE_TTL });
      return null;
    }

    // Trouver la credential correspondant à l'env demandé
    let credential = credentials.find(c => c.env === preferredEnv);
    if (!credential) {
      credential = credentials[0]; // Fallback sur la première disponible
    }

    if (!credential.secret_ref) {
      console.warn(`[Credentials] Clé vide pour ${providerName}`);
      credentialsCache.set(cacheKey, { data: null, expires: Date.now() + CACHE_TTL });
      return null;
    }

    // Déchiffrer la clé
    let apiKey: string;
    try {
      apiKey = decryptKey(credential.secret_ref);
    } catch (decryptError) {
      console.error(`[Credentials] Erreur déchiffrement pour ${providerName}:`, decryptError);
      credentialsCache.set(cacheKey, { data: null, expires: Date.now() + CACHE_TTL });
      return null;
    }

    // Parser la config (stockée dans scope)
    let config: Record<string, string> = {};
    try {
      if (credential.scope) {
        config = JSON.parse(credential.scope);
      }
    } catch {
      // scope n'est pas du JSON valide
    }

    const result: ProviderCredentials = {
      apiKey,
      config,
      env: credential.env,
    };

    // Mettre en cache
    credentialsCache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
    
    return result;
  } catch (error) {
    console.error(`[Credentials] Erreur récupération pour ${providerName}:`, error);
    return null;
  }
}

/**
 * Vérifie si un provider est configuré
 */
export async function isProviderConfigured(providerName: ProviderName): Promise<boolean> {
  const credentials = await getProviderCredentials(providerName);
  return credentials !== null && credentials.apiKey.length > 0;
}

/**
 * Récupère les credentials Resend
 */
export async function getResendCredentials(): Promise<{
  apiKey: string;
  emailFrom: string;
} | null> {
  const credentials = await getProviderCredentials("Resend");
  
  if (!credentials) {
    // Fallback sur les variables d'environnement
    const envApiKey = process.env.RESEND_API_KEY;
    const envEmailFrom = process.env.EMAIL_FROM;
    
    if (envApiKey) {
      return {
        apiKey: envApiKey,
        emailFrom: envEmailFrom || "Talok <onboarding@resend.dev>",
      };
    }
    return null;
  }

  return {
    apiKey: credentials.apiKey,
    emailFrom: credentials.config.email_from || process.env.EMAIL_FROM || "Talok <onboarding@resend.dev>",
  };
}

/**
 * Récupère les credentials Twilio
 */
export async function getTwilioCredentials(): Promise<{
  accountSid: string;
  authToken: string;
  phoneNumber: string;
} | null> {
  const credentials = await getProviderCredentials("Twilio");
  
  if (!credentials) {
    // Fallback sur les variables d'environnement
    const envSid = process.env.TWILIO_ACCOUNT_SID;
    const envToken = process.env.TWILIO_AUTH_TOKEN;
    const envPhone = process.env.TWILIO_PHONE_NUMBER;
    
    if (envSid && envToken) {
      return {
        accountSid: envSid,
        authToken: envToken,
        phoneNumber: envPhone || "",
      };
    }
    return null;
  }

  return {
    accountSid: credentials.config.account_sid || "",
    authToken: credentials.apiKey,
    phoneNumber: credentials.config.phone_number || "",
  };
}

/**
 * Récupère les credentials Stripe
 */
export async function getStripeCredentials(): Promise<{
  secretKey: string;
  webhookSecret: string;
} | null> {
  const credentials = await getProviderCredentials("Stripe");
  
  if (!credentials) {
    // Fallback sur les variables d'environnement
    const envKey = process.env.STRIPE_SECRET_KEY;
    const envWebhook = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (envKey) {
      return {
        secretKey: envKey,
        webhookSecret: envWebhook || "",
      };
    }
    return null;
  }

  return {
    secretKey: credentials.apiKey,
    webhookSecret: credentials.config.webhook_secret || "",
  };
}

/**
 * Invalide le cache pour un provider (utile après mise à jour des credentials)
 */
export function invalidateCredentialsCache(providerName?: ProviderName): void {
  if (providerName) {
    credentialsCache.delete(`${providerName}:prod`);
    credentialsCache.delete(`${providerName}:dev`);
  } else {
    credentialsCache.clear();
  }
}

