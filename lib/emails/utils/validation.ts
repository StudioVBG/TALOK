/**
 * Email validation utilities
 *
 * Validation des adresses email et du contenu avant envoi.
 */

// Regex RFC 5322 simplifiée mais robuste
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Domaines email jetables/temporaires courants à bloquer
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  'throwaway.email',
  'guerrillamail.com',
  'mailinator.com',
  'yopmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'fakeinbox.com',
  'trashmail.com',
  'dispostable.com',
]);

export interface EmailValidationOptions {
  /** Autoriser les adresses vides (défaut: false) */
  allowEmpty?: boolean;
  /** Bloquer les domaines jetables (défaut: true en prod) */
  blockDisposable?: boolean;
  /** Longueur maximale de l'adresse (défaut: 254) */
  maxLength?: number;
}

export interface EmailValidationResult {
  valid: boolean;
  email: string;
  error?: string;
}

export interface BatchValidationResult {
  valid: boolean;
  validEmails: string[];
  invalidEmails: { email: string; error: string }[];
}

/**
 * Vérifie si une chaîne est une adresse email valide
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmed = email.trim();

  // Vérifier la longueur (RFC 5321)
  if (trimmed.length > 254) {
    return false;
  }

  // Vérifier le format
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Extrait le domaine d'une adresse email
 */
export function getEmailDomain(email: string): string | null {
  if (!email || !email.includes('@')) {
    return null;
  }
  return email.split('@')[1]?.toLowerCase() || null;
}

/**
 * Vérifie si un domaine est un service d'email jetable
 */
export function isDisposableEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Valide une adresse email avec options
 */
export function validateEmail(
  email: string,
  options: EmailValidationOptions = {}
): EmailValidationResult {
  const {
    allowEmpty = false,
    blockDisposable = process.env.NODE_ENV === 'production',
    maxLength = 254,
  } = options;

  // Normaliser
  const normalized = (email || '').trim().toLowerCase();

  // Vérifier si vide
  if (!normalized) {
    if (allowEmpty) {
      return { valid: true, email: '' };
    }
    return { valid: false, email: '', error: 'Adresse email requise' };
  }

  // Vérifier la longueur
  if (normalized.length > maxLength) {
    return {
      valid: false,
      email: normalized,
      error: `Adresse email trop longue (max ${maxLength} caractères)`,
    };
  }

  // Vérifier le format
  if (!EMAIL_REGEX.test(normalized)) {
    return {
      valid: false,
      email: normalized,
      error: 'Format d\'adresse email invalide',
    };
  }

  // Vérifier les domaines jetables
  if (blockDisposable && isDisposableEmail(normalized)) {
    return {
      valid: false,
      email: normalized,
      error: 'Les adresses email temporaires ne sont pas acceptées',
    };
  }

  return { valid: true, email: normalized };
}

/**
 * Valide un tableau d'adresses email
 */
export function validateEmails(
  emails: string | string[],
  options: EmailValidationOptions = {}
): BatchValidationResult {
  const emailList = Array.isArray(emails) ? emails : [emails];

  const validEmails: string[] = [];
  const invalidEmails: { email: string; error: string }[] = [];

  for (const email of emailList) {
    const result = validateEmail(email, options);
    if (result.valid && result.email) {
      validEmails.push(result.email);
    } else {
      invalidEmails.push({
        email: email || '',
        error: result.error || 'Adresse invalide',
      });
    }
  }

  return {
    valid: invalidEmails.length === 0 && validEmails.length > 0,
    validEmails,
    invalidEmails,
  };
}

/**
 * Valide les champs requis pour un email
 */
export interface EmailContentValidation {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export function validateEmailContent(
  content: Partial<EmailContentValidation>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Vérifier les destinataires
  if (!content.to) {
    errors.push('Destinataire requis');
  } else {
    const recipients = Array.isArray(content.to) ? content.to : [content.to];
    if (recipients.length === 0) {
      errors.push('Au moins un destinataire requis');
    } else {
      const validation = validateEmails(recipients);
      if (!validation.valid) {
        errors.push(
          `Destinataires invalides: ${validation.invalidEmails.map(e => e.email || 'vide').join(', ')}`
        );
      }
    }
  }

  // Vérifier le sujet
  if (!content.subject?.trim()) {
    errors.push('Sujet requis');
  } else if (content.subject.length > 998) {
    // RFC 5322 limite les lignes à 998 caractères
    errors.push('Sujet trop long (max 998 caractères)');
  }

  // Vérifier le contenu
  if (!content.html?.trim() && !content.text?.trim()) {
    errors.push('Contenu requis (html ou text)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalise un tableau de destinataires
 * - Supprime les doublons
 * - Normalise en minuscules
 * - Filtre les adresses invalides
 */
export function normalizeRecipients(
  recipients: string | string[]
): { emails: string[]; removed: string[] } {
  const emailList = Array.isArray(recipients) ? recipients : [recipients];
  const seen = new Set<string>();
  const emails: string[] = [];
  const removed: string[] = [];

  for (const email of emailList) {
    const normalized = (email || '').trim().toLowerCase();

    if (!normalized) {
      removed.push(email);
      continue;
    }

    if (seen.has(normalized)) {
      removed.push(email);
      continue;
    }

    if (!isValidEmail(normalized)) {
      removed.push(email);
      continue;
    }

    seen.add(normalized);
    emails.push(normalized);
  }

  return { emails, removed };
}
