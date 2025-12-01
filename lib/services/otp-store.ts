/**
 * Store pour les codes OTP
 * En développement : stockage en mémoire
 * En production : utiliser Redis ou une table dédiée
 */

interface OTPData {
  code: string;
  phone: string;
  expiresAt: Date;
  attempts: number;
}

// Stocker les codes OTP en mémoire pour le développement
// En production, remplacer par Redis ou table Supabase
export const otpStore = new Map<string, OTPData>();

/**
 * Sauvegarder un code OTP
 */
export function setOTP(key: string, data: OTPData): void {
  otpStore.set(key, data);
}

/**
 * Récupérer un code OTP
 */
export function getOTP(key: string): OTPData | undefined {
  return otpStore.get(key);
}

/**
 * Supprimer un code OTP
 */
export function deleteOTP(key: string): boolean {
  return otpStore.delete(key);
}

/**
 * Vérifier un code OTP
 */
export function verifyOTP(key: string, code: string): { valid: boolean; error?: string } {
  const otpData = otpStore.get(key);
  
  if (!otpData) {
    return { valid: false, error: "Aucun code OTP trouvé. Veuillez en demander un nouveau." };
  }
  
  // Vérifier l'expiration
  if (new Date() > otpData.expiresAt) {
    otpStore.delete(key);
    return { valid: false, error: "Le code a expiré. Veuillez en demander un nouveau." };
  }
  
  // Incrémenter les tentatives
  otpData.attempts += 1;
  
  // Bloquer après 5 tentatives
  if (otpData.attempts > 5) {
    otpStore.delete(key);
    return { valid: false, error: "Trop de tentatives. Veuillez demander un nouveau code." };
  }
  
  // Vérifier le code
  if (otpData.code !== code) {
    return { valid: false, error: `Code incorrect. ${5 - otpData.attempts} tentatives restantes.` };
  }
  
  // Code valide - supprimer après utilisation
  otpStore.delete(key);
  return { valid: true };
}



