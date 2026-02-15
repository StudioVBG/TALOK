/**
 * Validation des fichiers uploadés
 * Whitelist MIME types et taille maximale
 *
 * @module lib/security/file-validation
 * @security CRITICAL - Prévention upload malveillant (XSS stored, exécutables)
 */

/**
 * Types MIME autorisés par catégorie
 */
export const ALLOWED_MIME_TYPES = {
  /** Documents */
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
    "text/plain",
  ],
  /** Images */
  images: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ],
  /** Tableurs */
  spreadsheets: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ],
} as const;

/**
 * Tous les types MIME autorisés (union de toutes les catégories)
 */
export const ALL_ALLOWED_MIME_TYPES: readonly string[] = [
  ...ALLOWED_MIME_TYPES.documents,
  ...ALLOWED_MIME_TYPES.images,
  ...ALLOWED_MIME_TYPES.spreadsheets,
];

/**
 * Extensions de fichiers autorisées (mapping depuis les MIME types)
 */
export const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "odt",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "xls",
  "xlsx",
  "csv",
]);

/**
 * Extensions dangereuses explicitement bloquées
 */
const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "msi", "scr", "pif",
  "html", "htm", "xhtml", "svg",
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "php", "py", "rb", "sh", "bash", "ps1", "psm1",
  "jar", "class", "war",
  "dll", "so", "dylib",
  "vbs", "vbe", "wsf", "wsc", "wsh",
  "reg", "inf", "lnk",
]);

/**
 * Taille maximale par défaut (10 MB)
 */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Tailles maximales par contexte
 */
export const MAX_FILE_SIZES = {
  /** Documents généraux */
  document: 10 * 1024 * 1024,     // 10 MB
  /** Photos de propriétés */
  propertyPhoto: 10 * 1024 * 1024, // 10 MB
  /** Avatars */
  avatar: 2 * 1024 * 1024,         // 2 MB
  /** Pièces d'identité */
  identity: 10 * 1024 * 1024,      // 10 MB
  /** Signatures */
  signature: 500 * 1024,            // 500 KB
} as const;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  /** Code erreur pour le client */
  code?: "INVALID_MIME" | "BLOCKED_EXTENSION" | "FILE_TOO_LARGE" | "NO_EXTENSION" | "EMPTY_FILE";
}

/**
 * Valide un fichier uploadé (MIME, extension, taille)
 *
 * @param file - Le fichier à valider
 * @param options - Options de validation
 * @returns Résultat de la validation
 */
export function validateFile(
  file: File,
  options: {
    /** Types MIME autorisés (défaut: ALL_ALLOWED_MIME_TYPES) */
    allowedMimeTypes?: readonly string[];
    /** Taille maximale en bytes (défaut: DEFAULT_MAX_FILE_SIZE) */
    maxSize?: number;
    /** Autoriser les fichiers sans extension (défaut: false) */
    allowNoExtension?: boolean;
  } = {}
): FileValidationResult {
  const {
    allowedMimeTypes = ALL_ALLOWED_MIME_TYPES,
    maxSize = DEFAULT_MAX_FILE_SIZE,
    allowNoExtension = false,
  } = options;

  // 1. Vérifier que le fichier n'est pas vide
  if (file.size === 0) {
    return {
      valid: false,
      error: "Le fichier est vide.",
      code: "EMPTY_FILE",
    };
  }

  // 2. Vérifier la taille
  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Le fichier dépasse la taille maximale autorisée (${maxMB} Mo).`,
      code: "FILE_TOO_LARGE",
    };
  }

  // 3. Vérifier l'extension
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension) {
    if (!allowNoExtension) {
      return {
        valid: false,
        error: "Le fichier doit avoir une extension.",
        code: "NO_EXTENSION",
      };
    }
  } else if (BLOCKED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: `L'extension .${extension} n'est pas autorisée pour des raisons de sécurité.`,
      code: "BLOCKED_EXTENSION",
    };
  }

  // 4. Vérifier le type MIME
  // Note: Le MIME type du navigateur peut être falsifié, mais c'est une première ligne de défense.
  // Une validation plus robuste nécessiterait de vérifier les magic bytes du fichier.
  if (file.type && !allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Le type de fichier "${file.type}" n'est pas autorisé. Types acceptés : PDF, images (JPEG, PNG, WebP), documents Office.`,
      code: "INVALID_MIME",
    };
  }

  // 5. Double vérification: l'extension doit correspondre à un type autorisé
  if (extension && !ALLOWED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: `L'extension .${extension} n'est pas autorisée. Extensions acceptées : ${Array.from(ALLOWED_EXTENSIONS).join(", ")}.`,
      code: "BLOCKED_EXTENSION",
    };
  }

  return { valid: true };
}

/**
 * Valide plusieurs fichiers d'un coup
 */
export function validateFiles(
  files: File[],
  options: Parameters<typeof validateFile>[1] = {}
): FileValidationResult {
  for (const file of files) {
    const result = validateFile(file, options);
    if (!result.valid) {
      return {
        ...result,
        error: `Fichier "${file.name}" : ${result.error}`,
      };
    }
  }
  return { valid: true };
}
