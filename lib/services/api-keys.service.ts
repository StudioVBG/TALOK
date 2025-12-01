/**
 * Service de gestion des clés API
 * 
 * Récupère les clés API depuis la base de données de manière sécurisée.
 * Les clés sont stockées chiffrées avec AES-256-GCM et déchiffrées à la volée.
 * 
 * Fonctionnalités:
 * - Cache en mémoire (5 min TTL) pour performance
 * - Fallback sur variables d'environnement
 * - Tracking d'usage automatique
 * - Support multi-environnement (prod, staging, dev)
 */

import * as crypto from "crypto";

// Types
export type ProviderName = 
  | "mindee" 
  | "yousign" 
  | "stripe" 
  | "brevo" 
  | "twilio" 
  | "google_vision"
  | "aws_textract"
  | "docusign"
  | "gocardless"
  | "pappers";

export type Environment = "prod" | "staging" | "dev" | "test";

interface CacheEntry {
  key: string;
  expiry: number;
  credentialId: string;
}

interface ApiKeyResult {
  key: string;
  credentialId: string;
  providerId: string;
  name: string;
  env: string;
}

// Mapping des variables d'environnement par provider
const ENV_VAR_MAP: Record<ProviderName, string> = {
  mindee: "MINDEE_API_KEY",
  yousign: "YOUSIGN_API_KEY",
  stripe: "STRIPE_SECRET_KEY",
  brevo: "BREVO_API_KEY",
  twilio: "TWILIO_AUTH_TOKEN",
  google_vision: "GOOGLE_VISION_API_KEY",
  aws_textract: "AWS_TEXTRACT_ACCESS_KEY",
  docusign: "DOCUSIGN_INTEGRATION_KEY",
  gocardless: "GOCARDLESS_ACCESS_TOKEN",
  pappers: "PAPPERS_API_KEY",
};

/**
 * Service pour récupérer les clés API depuis la base de données
 */
class ApiKeysService {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Récupérer une clé API pour un provider
   * Priorité: Cache > BDD > Variables d'environnement
   */
  async getApiKey(
    provider: ProviderName, 
    env: Environment = "prod"
  ): Promise<string | null> {
    const cacheKey = `${provider}:${env}`;
    
    // 1. Vérifier le cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      // Incrémenter l'usage en arrière-plan
      this.incrementUsage(cached.credentialId).catch(() => {});
      return cached.key;
    }

    // 2. Essayer de récupérer depuis la BDD
    try {
      const result = await this.fetchFromDatabase(provider, env);
      if (result) {
        // Mettre en cache
        this.cache.set(cacheKey, {
          key: result.key,
          expiry: Date.now() + this.cacheTTL,
          credentialId: result.credentialId,
        });
        return result.key;
      }
    } catch (error) {
      console.warn(`[ApiKeysService] Erreur BDD pour ${provider}:`, error);
    }

    // 3. Fallback sur les variables d'environnement
    return this.getEnvFallback(provider);
  }

  /**
   * Récupérer depuis la base de données
   */
  private async fetchFromDatabase(
    provider: ProviderName,
    env: Environment
  ): Promise<ApiKeyResult | null> {
    // Import dynamique pour éviter les problèmes côté client
    const { createServiceRoleClient } = await import("@/lib/server/service-role-client");
    const supabase = createServiceRoleClient();

    // Requête pour obtenir la clé active
    const { data, error } = await supabase
      .from("api_credentials")
      .select(`
        id,
        encrypted_key,
        name,
        env,
        provider_id,
        provider:api_providers!inner(id, name)
      `)
      .eq("is_active", true)
      .eq("env", env)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ApiKeysService] Erreur Supabase:", error);
      return null;
    }

    // Filtrer par nom de provider (car le join ne filtre pas correctement)
    const credential = (data || []).find((c: any) => 
      c.provider?.name === provider
    );

    if (!credential) {
      return null;
    }

    // Déchiffrer la clé
    try {
      const decryptedKey = this.decryptKey((credential as any).encrypted_key);
      
      return {
        key: decryptedKey,
        credentialId: (credential as any).id,
        providerId: (credential as any).provider_id,
        name: (credential as any).name,
        env: (credential as any).env,
      };
    } catch (decryptError) {
      console.error("[ApiKeysService] Erreur déchiffrement:", decryptError);
      return null;
    }
  }

  /**
   * Récupérer la clé depuis les variables d'environnement (fallback)
   */
  private getEnvFallback(provider: ProviderName): string | null {
    const envVar = ENV_VAR_MAP[provider];
    const value = process.env[envVar];
    
    if (value) {
      console.log(`[ApiKeysService] Utilisation fallback env pour ${provider}`);
    }
    
    return value || null;
  }

  /**
   * Déchiffrer une clé API avec AES-256-GCM
   */
  private decryptKey(encryptedKey: string): string {
    const masterKey = this.getMasterKey();
    const algorithm = "aes-256-gcm";
    const key = crypto.scryptSync(masterKey, "salt", 32);
    
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
   * Obtenir la clé maître pour le chiffrement
   */
  private getMasterKey(): string {
    // Priorité: API_KEY_MASTER_KEY > partie de SUPABASE_SERVICE_ROLE_KEY
    if (process.env.API_KEY_MASTER_KEY) {
      return process.env.API_KEY_MASTER_KEY;
    }
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 32);
    }
    
    console.warn("[ApiKeysService] ⚠️ Utilisation de la clé maître par défaut - NON SÉCURISÉ EN PRODUCTION");
    return "default-master-key-32-chars!!";
  }

  /**
   * Incrémenter le compteur d'usage
   */
  private async incrementUsage(credentialId: string): Promise<void> {
    try {
      const { createServiceRoleClient } = await import("@/lib/server/service-role-client");
      const supabase = createServiceRoleClient();
      
      await supabase.rpc("increment_api_usage", { 
        p_credential_id: credentialId 
      });
    } catch (error) {
      // Ne pas bloquer si l'incrémentation échoue
      console.warn("[ApiKeysService] Erreur incrémentation usage:", error);
    }
  }

  /**
   * Logger un appel API (pour analytics)
   */
  async logApiCall(
    credentialId: string,
    endpoint: string,
    statusCode: number,
    responseTimeMs: number,
    costEstimate?: number
  ): Promise<void> {
    try {
      const { createServiceRoleClient } = await import("@/lib/server/service-role-client");
      const supabase = createServiceRoleClient();
      
      await supabase.from("api_usage_logs").insert({
        credential_id: credentialId,
        endpoint,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        cost_estimate: costEstimate,
      });
    } catch (error) {
      console.warn("[ApiKeysService] Erreur log usage:", error);
    }
  }

  /**
   * Vider le cache (utile après rotation de clé)
   */
  clearCache(provider?: ProviderName): void {
    if (provider) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${provider}:`)) {
          this.cache.delete(key);
        }
      }
      console.log(`[ApiKeysService] Cache vidé pour ${provider}`);
    } else {
      this.cache.clear();
      console.log("[ApiKeysService] Cache entièrement vidé");
    }
  }

  /**
   * Vérifier si un provider a une clé configurée
   */
  async hasApiKey(provider: ProviderName, env: Environment = "prod"): Promise<boolean> {
    const key = await this.getApiKey(provider, env);
    return key !== null && key.length > 0;
  }

  /**
   * Obtenir le statut de tous les providers
   */
  async getProvidersStatus(): Promise<Record<ProviderName, boolean>> {
    const providers = Object.keys(ENV_VAR_MAP) as ProviderName[];
    const status: Record<string, boolean> = {};
    
    for (const provider of providers) {
      status[provider] = await this.hasApiKey(provider);
    }
    
    return status as Record<ProviderName, boolean>;
  }
}

// Export singleton
export const apiKeysService = new ApiKeysService();

// Export classe pour tests ou usage custom
export { ApiKeysService };

