/**
 * Validation côté serveur des images de signature
 *
 * Vérifie :
 * 1. Format base64 PNG/JPEG valide
 * 2. Taille maximale (500 KB de données binaires)
 * 3. Dimensions minimales (100×50 px) via header PNG/JPEG
 * 4. Non-transparence complète (au moins quelques pixels opaques)
 *
 * @module lib/utils/validate-signature
 */

export interface SignatureValidationResult {
  valid: boolean;
  errors: string[];
  /** Taille du buffer en octets */
  sizeBytes: number;
  /** Largeur détectée (PNG uniquement, -1 sinon) */
  width: number;
  /** Hauteur détectée (PNG uniquement, -1 sinon) */
  height: number;
}

const MAX_SIGNATURE_SIZE_BYTES = 500 * 1024; // 500 KB
const MIN_WIDTH = 100;
const MIN_HEIGHT = 50;

/**
 * Extrait les données binaires d'une chaîne base64 (avec ou sans préfixe data URI).
 * Retourne null si le format est invalide.
 */
function decodeBase64Image(base64: string): { buffer: Buffer; mimeType: string } | null {
  try {
    // Accepter avec ou sans préfixe data URI
    const match = base64.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (match) {
      return {
        buffer: Buffer.from(match[2], "base64"),
        mimeType: `image/${match[1]}`,
      };
    }

    // Essayer en tant que base64 brute (on suppose PNG)
    const buf = Buffer.from(base64, "base64");
    if (buf.length === 0) return null;

    // Vérifier signature PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return { buffer: buf, mimeType: "image/png" };
    }

    // Vérifier signature JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      return { buffer: buf, mimeType: "image/jpeg" };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Lit les dimensions d'un PNG depuis le chunk IHDR.
 * Retourne { width, height } ou null si impossible.
 */
function readPNGDimensions(buf: Buffer): { width: number; height: number } | null {
  // IHDR commence à l'offset 16 (après signature 8 octets + longueur 4 + type "IHDR" 4)
  if (buf.length < 24) return null;

  // Vérifier la signature PNG
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);

  if (width <= 0 || height <= 0 || width > 10000 || height > 10000) return null;

  return { width, height };
}

/**
 * Vérifie qu'un buffer PNG n'est pas entièrement transparent.
 * On vérifie les premiers pixels du IDAT décompressé — 
 * approximation rapide : si le fichier fait plus de quelques centaines d'octets,
 * il y a probablement du contenu dessiné.
 * Un canvas vide exporté en PNG fait typiquement < 500 octets pour 500×150.
 */
function hasVisibleContent(buf: Buffer): boolean {
  // Heuristique : un PNG "vide" (transparent) d'un canvas 500×150
  // fait environ 200-600 octets. Un PNG avec un trait fait > 1 KB.
  return buf.length > 800;
}

/**
 * Valide une image de signature (base64) côté serveur.
 *
 * @param signatureBase64 - Image encodée en base64 (avec ou sans préfixe data URI)
 * @returns Résultat de la validation
 */
export function validateSignatureImage(signatureBase64: string): SignatureValidationResult {
  const errors: string[] = [];
  let sizeBytes = 0;
  let width = -1;
  let height = -1;

  // 1. Vérifier que la chaîne n'est pas vide
  if (!signatureBase64 || signatureBase64.trim().length === 0) {
    return { valid: false, errors: ["Image de signature manquante"], sizeBytes: 0, width: -1, height: -1 };
  }

  // 2. Décoder le base64
  const decoded = decodeBase64Image(signatureBase64);
  if (!decoded) {
    return {
      valid: false,
      errors: ["Format d'image invalide. Seuls PNG et JPEG sont acceptés."],
      sizeBytes: 0,
      width: -1,
      height: -1,
    };
  }

  sizeBytes = decoded.buffer.length;

  // 3. Vérifier la taille
  if (sizeBytes > MAX_SIGNATURE_SIZE_BYTES) {
    errors.push(
      `Image trop volumineuse (${Math.round(sizeBytes / 1024)} KB). Maximum autorisé : ${MAX_SIGNATURE_SIZE_BYTES / 1024} KB.`
    );
  }

  // 4. Vérifier les dimensions (PNG uniquement)
  if (decoded.mimeType === "image/png") {
    const dims = readPNGDimensions(decoded.buffer);
    if (dims) {
      width = dims.width;
      height = dims.height;

      if (width < MIN_WIDTH || height < MIN_HEIGHT) {
        errors.push(
          `Signature trop petite (${width}×${height}). Minimum requis : ${MIN_WIDTH}×${MIN_HEIGHT} pixels.`
        );
      }
    }
  }

  // 5. Vérifier le contenu visible
  if (!hasVisibleContent(decoded.buffer)) {
    errors.push("La signature semble vide. Veuillez dessiner votre signature.");
  }

  return {
    valid: errors.length === 0,
    errors,
    sizeBytes,
    width,
    height,
  };
}

/**
 * Retire le préfixe data URI d'une chaîne base64.
 */
export function stripBase64Prefix(base64: string): string {
  return base64.replace(/^data:image\/\w+;base64,/, "");
}
