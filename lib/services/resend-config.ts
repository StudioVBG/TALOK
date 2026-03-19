import { getProviderCredentials } from "@/lib/services/credentials-service";

export type ResendConfigSource = "environment" | "database" | "none";
export type ResendFromSource = "environment" | "database" | "default";

export interface ResendRuntimeConfig {
  apiKey: string;
  rawFromAddress: string;
  fromAddress: string;
  replyTo: string | null;
  dbCheckFailed: boolean;
  normalizedFromAddressChanged: boolean;
  sources: {
    apiKey: ResendConfigSource;
    fromAddress: ResendFromSource;
    replyTo: ResendFromSource;
  };
  dbCredentialEnv: string | null;
}

interface ResolveResendConfigOptions {
  preferredFrom?: string;
  preferredReplyTo?: string;
  skipDatabase?: boolean;
  apiKeyOverride?: string;
}

const DEFAULT_FROM = "Talok <noreply@talok.fr>";
const DEFAULT_FROM_NAME = "Talok";

function getEnvApiKey(): string {
  return process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "";
}

function getEnvFrom(): string {
  return process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
}

function getEnvReplyTo(): string | null {
  return process.env.EMAIL_REPLY_TO || process.env.RESEND_REPLY_TO || null;
}

function isConsumerMailbox(address: string): boolean {
  return /@(gmail|hotmail|outlook|yahoo)\./i.test(address);
}

export function normalizeResendFromAddress(fromAddress: string): string {
  let normalized = fromAddress.trim();

  if (normalized.includes("@send.")) {
    normalized = normalized.replace(/@send\./i, "@");
  }

  if (!normalized.includes("<") && !normalized.includes(">")) {
    if (isConsumerMailbox(normalized)) {
      console.warn(`[Email] Adresse consumer détectée (${normalized}), fallback vers ${DEFAULT_FROM}`);
      return DEFAULT_FROM;
    }

    return `${DEFAULT_FROM_NAME} <${normalized}>`;
  }

  return normalized;
}

export async function resolveResendRuntimeConfig(
  options: ResolveResendConfigOptions = {}
): Promise<ResendRuntimeConfig> {
  const envApiKey = getEnvApiKey();
  const envFrom = getEnvFrom();
  const envReplyTo = getEnvReplyTo();

  let dbCredential: Awaited<ReturnType<typeof getProviderCredentials>> = null;
  let dbCheckFailed = false;

  if (!options.skipDatabase) {
    try {
      dbCredential = await getProviderCredentials("Resend");
    } catch (error) {
      dbCheckFailed = true;
      console.warn("[Email] Impossible de récupérer les credentials Resend:", error);
    }
  }

  const apiKey = options.apiKeyOverride || dbCredential?.apiKey || envApiKey;
  const rawFromAddress =
    options.preferredFrom ||
    dbCredential?.config.email_from ||
    envFrom ||
    DEFAULT_FROM;
  const replyTo =
    options.preferredReplyTo ||
    dbCredential?.config.reply_to ||
    envReplyTo ||
    null;

  const normalizedFromAddress = normalizeResendFromAddress(rawFromAddress);

  return {
    apiKey,
    rawFromAddress,
    fromAddress: normalizedFromAddress,
    replyTo,
    dbCheckFailed,
    normalizedFromAddressChanged: normalizedFromAddress !== rawFromAddress,
    sources: {
      apiKey: options.apiKeyOverride
        ? "environment"
        : dbCredential?.apiKey
          ? "database"
          : envApiKey
            ? "environment"
            : "none",
      fromAddress: options.preferredFrom
        ? "environment"
        : dbCredential?.config.email_from
          ? "database"
          : process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL
            ? "environment"
            : "default",
      replyTo: options.preferredReplyTo
        ? "environment"
        : dbCredential?.config.reply_to
          ? "database"
          : envReplyTo
            ? "environment"
            : "default",
    },
    dbCredentialEnv: dbCredential?.env ?? null,
  };
}
