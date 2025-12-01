/**
 * Service France Identité / FranceConnect
 * Permet la vérification d'identité forte via FranceConnect
 * 
 * Documentation : https://partenaires.franceconnect.gouv.fr/
 */

import { logger } from "@/lib/monitoring";
import { getCredentials } from "./credentials-service";

// Configuration
const FRANCECONNECT_AUTHORIZATION_ENDPOINT = "https://app.franceconnect.gouv.fr/api/v1/authorize";
const FRANCECONNECT_TOKEN_ENDPOINT = "https://app.franceconnect.gouv.fr/api/v1/token";
const FRANCECONNECT_USERINFO_ENDPOINT = "https://app.franceconnect.gouv.fr/api/v1/userinfo";
const FRANCECONNECT_LOGOUT_ENDPOINT = "https://app.franceconnect.gouv.fr/api/v1/logout";

// Scopes disponibles
const SCOPES = [
  "openid",           // Obligatoire
  "given_name",       // Prénom
  "family_name",      // Nom
  "birthdate",        // Date de naissance
  "birthplace",       // Lieu de naissance
  "birthcountry",     // Pays de naissance
  "gender",           // Genre
  "email",            // Email (si disponible)
];

// Types
export interface FranceConnectConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface FranceConnectUser {
  sub: string;           // Identifiant unique FranceConnect
  givenName: string;     // Prénom
  familyName: string;    // Nom
  birthdate?: string;    // Date de naissance (YYYY-MM-DD)
  birthplace?: string;   // Code commune de naissance
  birthcountry?: string; // Pays de naissance
  gender?: "male" | "female";
  email?: string;
}

export interface AuthorizationResult {
  success: boolean;
  authorizationUrl?: string;
  state?: string;
  nonce?: string;
  error?: string;
}

export interface TokenResult {
  success: boolean;
  accessToken?: string;
  idToken?: string;
  error?: string;
}

export interface UserInfoResult {
  success: boolean;
  user?: FranceConnectUser;
  error?: string;
}

/**
 * Récupère la configuration FranceConnect
 */
async function getConfig(): Promise<FranceConnectConfig | null> {
  const credentials = await getCredentials("France Identité");
  
  if (!credentials?.apiKey) {
    // Fallback sur les variables d'environnement
    const clientId = process.env.FRANCECONNECT_CLIENT_ID;
    const clientSecret = process.env.FRANCECONNECT_CLIENT_SECRET;
    const redirectUri = process.env.FRANCECONNECT_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return null;
    }

    return { clientId, clientSecret, redirectUri };
  }

  // Parser la config depuis les credentials
  try {
    const config = credentials.config as any;
    return {
      clientId: credentials.apiKey,
      clientSecret: config?.client_secret || "",
      redirectUri: config?.redirect_uri || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/franceconnect/callback`,
    };
  } catch {
    return null;
  }
}

/**
 * Génère un état aléatoire pour la protection CSRF
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Génère un nonce pour la protection replay
 */
function generateNonce(): string {
  return generateState();
}

/**
 * Démarre le flux d'authentification FranceConnect
 */
export async function startFranceConnectAuth(
  context?: { leaseId?: string; returnUrl?: string }
): Promise<AuthorizationResult> {
  const config = await getConfig();

  if (!config) {
    logger.warn("FranceConnect not configured");
    return {
      success: false,
      error: "France Identité n'est pas configuré. Contactez l'administrateur.",
    };
  }

  const state = generateState();
  const nonce = generateNonce();

  // Encoder le contexte dans le state si nécessaire
  let stateWithContext = state;
  if (context?.leaseId || context?.returnUrl) {
    const contextData = Buffer.from(JSON.stringify({
      s: state,
      l: context.leaseId,
      r: context.returnUrl,
    })).toString("base64url");
    stateWithContext = contextData;
  }

  // Construire l'URL d'autorisation
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: SCOPES.join(" "),
    state: stateWithContext,
    nonce,
    acr_values: "eidas1", // Niveau de sécurité (eidas1 = substantiel)
  });

  const authorizationUrl = `${FRANCECONNECT_AUTHORIZATION_ENDPOINT}?${params.toString()}`;

  logger.info("FranceConnect auth started", { clientId: config.clientId.slice(0, 8) + "..." });

  return {
    success: true,
    authorizationUrl,
    state: stateWithContext,
    nonce,
  };
}

/**
 * Échange le code d'autorisation contre des tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  state: string
): Promise<TokenResult> {
  const config = await getConfig();

  if (!config) {
    return { success: false, error: "Configuration manquante" };
  }

  try {
    const response = await fetch(FRANCECONNECT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("FranceConnect token exchange failed", { status: response.status, error });
      return { success: false, error: "Échec de l'authentification" };
    }

    const data = await response.json();

    return {
      success: true,
      accessToken: data.access_token,
      idToken: data.id_token,
    };
  } catch (error) {
    logger.error("FranceConnect token exchange error", { error });
    return { success: false, error: "Erreur de connexion" };
  }
}

/**
 * Récupère les informations de l'utilisateur
 */
export async function getUserInfo(accessToken: string): Promise<UserInfoResult> {
  try {
    const response = await fetch(FRANCECONNECT_USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: "Impossible de récupérer les informations" };
    }

    const data = await response.json();

    const user: FranceConnectUser = {
      sub: data.sub,
      givenName: data.given_name || "",
      familyName: data.family_name || "",
      birthdate: data.birthdate,
      birthplace: data.birthplace,
      birthcountry: data.birthcountry,
      gender: data.gender,
      email: data.email,
    };

    logger.info("FranceConnect user info retrieved", { sub: user.sub.slice(0, 8) + "..." });

    return { success: true, user };
  } catch (error) {
    logger.error("FranceConnect userinfo error", { error });
    return { success: false, error: "Erreur lors de la récupération des informations" };
  }
}

/**
 * Déconnecte l'utilisateur de FranceConnect
 */
export async function logout(idToken: string, redirectUri?: string): Promise<string> {
  const params = new URLSearchParams({
    id_token_hint: idToken,
    state: generateState(),
    post_logout_redirect_uri: redirectUri || process.env.NEXT_PUBLIC_APP_URL || "",
  });

  return `${FRANCECONNECT_LOGOUT_ENDPOINT}?${params.toString()}`;
}

/**
 * Vérifie si FranceConnect est configuré
 */
export async function isFranceConnectConfigured(): Promise<boolean> {
  const config = await getConfig();
  return !!(config?.clientId && config?.clientSecret);
}

/**
 * Simule une vérification France Identité (pour le développement)
 */
export function simulateFranceConnectUser(
  firstName: string,
  lastName: string,
  birthDate?: string
): FranceConnectUser {
  return {
    sub: `simulated-${Date.now()}`,
    givenName: firstName,
    familyName: lastName,
    birthdate: birthDate,
    birthcountry: "99100", // France
    gender: undefined,
  };
}

export default {
  startFranceConnectAuth,
  exchangeCodeForTokens,
  getUserInfo,
  logout,
  isFranceConnectConfigured,
  simulateFranceConnectUser,
};

