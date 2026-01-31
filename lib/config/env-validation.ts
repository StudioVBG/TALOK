/**
 * Validation centralisée des variables d'environnement
 * Exécuté au démarrage de l'application
 *
 * @module lib/config/env-validation
 * @description Assure que toutes les variables critiques sont présentes et valides
 */

interface EnvVar {
  name: string;
  required: boolean;
  minLength?: number;
  validator?: (value: string) => boolean;
  description?: string;
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * Liste des variables d'environnement requises
 */
const ENV_VARS: EnvVar[] = [
  // Sécurité - Critiques
  {
    name: "API_KEY_MASTER_KEY",
    required: true,
    minLength: 32,
    description: "Master key for API key encryption (AES-256)",
  },
  {
    name: "CSRF_SECRET",
    required: true,
    minLength: 32,
    description: "Secret for CSRF token generation",
  },
  {
    name: "ENCRYPTION_KEY",
    required: true,
    minLength: 32,
    description: "Master key for sensitive data encryption (2FA secrets, IBANs)",
  },

  // Supabase - Critiques
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous key (public)",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    description: "Supabase service role key (server-side only)",
  },

  // Stripe - Critiques pour paiements
  {
    name: "STRIPE_SECRET_KEY",
    required: true,
    validator: (v) => v.startsWith("sk_"),
    description: "Stripe secret API key",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    required: true,
    validator: (v) => v.startsWith("whsec_"),
    description: "Stripe webhook signing secret",
  },
  {
    name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    required: true,
    validator: (v) => v.startsWith("pk_"),
    description: "Stripe publishable key (public)",
  },

  // Webhooks - Requis en production
  {
    name: "YOUSIGN_WEBHOOK_SECRET",
    required: isProduction,
    description: "Yousign webhook signing secret",
  },
  {
    name: "CRON_SECRET",
    required: isProduction,
    minLength: 16,
    description: "Secret for cron job authentication",
  },

  // Revalidation - Requis en production pour appels système
  {
    name: "REVALIDATION_SECRET",
    required: isProduction,
    minLength: 32,
    description: "Secret for internal revalidation API calls",
  },

  // Redis - Requis en production pour rate limiting
  {
    name: "UPSTASH_REDIS_REST_URL",
    required: isProduction,
    validator: (v) => v.startsWith("https://"),
    description: "Upstash Redis REST URL",
  },
  {
    name: "UPSTASH_REDIS_REST_TOKEN",
    required: isProduction,
    description: "Upstash Redis REST token",
  },

  // Email - Requis pour notifications
  {
    name: "RESEND_API_KEY",
    required: isProduction,
    validator: (v) => v.startsWith("re_"),
    description: "Resend API key for emails",
  },

  // SMS - Optionnel mais recommandé
  {
    name: "TWILIO_ACCOUNT_SID",
    required: false,
    validator: (v) => v.startsWith("AC"),
    description: "Twilio Account SID",
  },
  {
    name: "TWILIO_AUTH_TOKEN",
    required: false,
    description: "Twilio Auth Token",
  },

  // OpenAI - Optionnel pour AI features
  {
    name: "OPENAI_API_KEY",
    required: false,
    validator: (v) => v.startsWith("sk-"),
    description: "OpenAI API key",
  },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valide toutes les variables d'environnement
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    // Vérifier si requis
    if (envVar.required && !value) {
      errors.push(
        `Missing required environment variable: ${envVar.name}` +
          (envVar.description ? ` (${envVar.description})` : "")
      );
      continue;
    }

    // Si pas de valeur et pas requis, passer
    if (!value) {
      if (isProduction && envVar.description) {
        warnings.push(`Optional variable not set: ${envVar.name}`);
      }
      continue;
    }

    // Vérifier longueur minimum
    if (envVar.minLength && value.length < envVar.minLength) {
      errors.push(
        `${envVar.name} must be at least ${envVar.minLength} characters (got ${value.length})`
      );
    }

    // Vérifier validateur custom
    if (envVar.validator && !envVar.validator(value)) {
      errors.push(`${envVar.name} has invalid format`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Assertion de l'environnement au démarrage
 * Lance une erreur en production si l'environnement est invalide
 */
export function assertEnvironment(): void {
  // Skip côté client
  if (typeof window !== "undefined") return;

  const { valid, errors, warnings } = validateEnvironment();

  // Afficher les warnings
  if (warnings.length > 0) {
    console.warn("Environment warnings:");
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }

  // Gérer les erreurs
  if (!valid) {
    console.error("Environment validation failed:");
    errors.forEach((e) => console.error(`  - ${e}`));

    if (isProduction) {
      throw new Error(
        "Invalid environment configuration. Application cannot start. Check logs for details."
      );
    } else {
      console.warn(
        "\n⚠️  Running in development mode with invalid environment configuration.\n" +
          "   Some features may not work correctly.\n"
      );
    }
  } else {
    console.log("✅ Environment validation passed");
  }
}

/**
 * Récupère une variable d'environnement avec validation
 * @throws Error si la variable est requise mais absente
 */
export function getEnvVar(
  name: string,
  options: { required?: boolean; minLength?: number } = {}
): string | undefined {
  const value = process.env[name];
  const { required = false, minLength } = options;

  if (required && !value) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }

  if (value && minLength && value.length < minLength) {
    throw new Error(
      `Environment variable ${name} must be at least ${minLength} characters`
    );
  }

  return value;
}

/**
 * Récupère une variable d'environnement requise
 * @throws Error si la variable est absente
 */
export function requireEnvVar(name: string, minLength?: number): string {
  const value = getEnvVar(name, { required: true, minLength });
  return value!;
}
