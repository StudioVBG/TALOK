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
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: isProduction,
    validator: (v) => v.startsWith("http://") || v.startsWith("https://"),
    description: "Application base URL used in emails and auth redirects",
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
    name: "EMAIL_PROVIDER",
    required: false,
    validator: (v) => v === "resend",
    description: "Email provider identifier (currently only resend is supported)",
  },
  {
    name: "RESEND_API_KEY",
    required: false,
    validator: (v) => v.startsWith("re_"),
    description: "Resend API key for emails (optional if credentials are managed in Admin > Integrations)",
  },
  {
    name: "EMAIL_API_KEY",
    required: false,
    validator: (v) => v.startsWith("re_"),
    description: "Legacy alias for Resend API key",
  },
  {
    name: "INTERNAL_EMAIL_API_KEY",
    required: false,
    minLength: 32,
    description: "Secret for internal calls to /api/emails/send",
  },
  {
    name: "PASSWORD_RESET_COOKIE_SECRET",
    required: isProduction,
    minLength: 32,
    description: "Secret used to sign password reset access cookies",
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
  {
    name: "TWILIO_VERIFY_SERVICE_SID",
    required: false,
    validator: (v) => v.startsWith("VA"),
    description: "Twilio Verify Service SID (required for phone OTP)",
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

  if (!process.env.RESEND_API_KEY && !process.env.EMAIL_API_KEY) {
    warnings.push(
      "No email API key found in environment. Production email delivery must be configured via Admin > Integrations if you rely on DB credentials."
    );
  }

  if (!process.env.EMAIL_FROM && !process.env.RESEND_FROM_EMAIL) {
    warnings.push(
      "No explicit sender address configured. The email service will fall back to Talok <noreply@talok.fr>."
    );
  }

  if (!process.env.EMAIL_REPLY_TO && !process.env.RESEND_REPLY_TO) {
    warnings.push(
      "No reply-to address configured for transactional emails."
    );
  }

  if (isProduction && !process.env.INTERNAL_EMAIL_API_KEY) {
    warnings.push(
      "INTERNAL_EMAIL_API_KEY is not set. Internal server-to-server email flows may fail."
    );
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
