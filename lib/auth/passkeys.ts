/**
 * Passkeys / WebAuthn - SOTA 2026
 * Authentification sans mot de passe via biométrie ou clé de sécurité
 */

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";

export interface PasskeyCredential {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: "singleDevice" | "multiDevice";
  backed_up: boolean;
  transports?: string[];
  created_at: string;
  last_used_at?: string;
  friendly_name?: string;
}

/**
 * Vérifie si le navigateur supporte WebAuthn
 */
export function isWebAuthnSupported(): boolean {
  return browserSupportsWebAuthn();
}

/**
 * Vérifie si le navigateur supporte l'autofill WebAuthn (Conditional UI)
 */
export async function isConditionalUISupported(): Promise<boolean> {
  return browserSupportsWebAuthnAutofill();
}

/**
 * Démarre l'enregistrement d'une passkey
 */
export async function registerPasskey(
  options: PublicKeyCredentialCreationOptionsJSON
): Promise<RegistrationResponseJSON> {
  try {
    const response = await startRegistration({ optionsJSON: options });
    return response;
  } catch (error: unknown) {
    if (error.name === "InvalidStateError") {
      throw new Error("Cette passkey est déjà enregistrée sur cet appareil.");
    }
    if (error.name === "NotAllowedError") {
      throw new Error("L'enregistrement de la passkey a été annulé.");
    }
    throw error;
  }
}

/**
 * Démarre l'authentification avec une passkey
 */
export async function authenticateWithPasskey(
  options: PublicKeyCredentialRequestOptionsJSON,
  useAutofill: boolean = false
): Promise<AuthenticationResponseJSON> {
  try {
    const response = await startAuthentication({
      optionsJSON: options,
      useBrowserAutofill: useAutofill,
    });
    return response;
  } catch (error: unknown) {
    if (error.name === "NotAllowedError") {
      throw new Error("L'authentification avec passkey a été annulée.");
    }
    throw error;
  }
}

/**
 * Obtient les informations sur les passkeys disponibles
 */
export function getPasskeyDisplayInfo(credential: PasskeyCredential): {
  icon: string;
  label: string;
  lastUsed: string;
} {
  const icons: Record<string, string> = {
    singleDevice: "🔑",
    multiDevice: "☁️",
  };

  const labels: Record<string, string> = {
    singleDevice: "Clé de sécurité",
    multiDevice: "Passkey synchronisée",
  };

  const lastUsed = credential.last_used_at
    ? new Date(credential.last_used_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Jamais utilisée";

  return {
    icon: icons[credential.device_type] || "🔐",
    label: credential.friendly_name || labels[credential.device_type] || "Passkey",
    lastUsed,
  };
}
