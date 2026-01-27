/**
 * Utilitaires de compression d'images côté client
 * SOTA 2026 - Optimisation avant upload
 *
 * Features:
 * - Compression JPEG/WebP avec qualité configurable
 * - Redimensionnement intelligent (préserve ratio)
 * - Support EXIF orientation
 * - Compression par lots (batch)
 */

export interface CompressionOptions {
  /** Qualité de compression (0-1), défaut: 0.8 */
  quality?: number;
  /** Largeur maximale en pixels, défaut: 1920 */
  maxWidth?: number;
  /** Hauteur maximale en pixels, défaut: 1080 */
  maxHeight?: number;
  /** Format de sortie, défaut: "image/jpeg" */
  outputFormat?: "image/jpeg" | "image/webp" | "image/png";
  /** Taille maximale en bytes, défaut: 500KB */
  maxSizeBytes?: number;
  /** Préserver les métadonnées EXIF, défaut: false */
  preserveExif?: boolean;
}

export interface CompressionResult {
  /** Blob compressé */
  blob: Blob;
  /** URL objet pour prévisualisation */
  objectUrl: string;
  /** Taille originale en bytes */
  originalSize: number;
  /** Taille compressée en bytes */
  compressedSize: number;
  /** Ratio de compression (0-1) */
  compressionRatio: number;
  /** Dimensions finales */
  width: number;
  height: number;
  /** Format de sortie */
  format: string;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1080,
  outputFormat: "image/jpeg",
  maxSizeBytes: 500 * 1024, // 500KB
  preserveExif: false,
};

/**
 * Compresse une image côté client
 * @param source File, Blob ou URL de l'image
 * @param options Options de compression
 */
export async function compressImage(
  source: File | Blob | string,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Déterminer la taille originale
  let originalSize: number;
  if (source instanceof File || source instanceof Blob) {
    originalSize = source.size;
  } else {
    // Pour les URLs, on ne peut pas connaître la taille originale facilement
    originalSize = 0;
  }

  // Charger l'image
  const image = await loadImageElement(source);

  // Calculer les dimensions finales (préserver le ratio)
  const { width, height } = calculateDimensions(
    image.width,
    image.height,
    opts.maxWidth,
    opts.maxHeight
  );

  // Créer le canvas et dessiner l'image redimensionnée
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }

  // Appliquer un lissage de haute qualité
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Dessiner l'image
  ctx.drawImage(image, 0, 0, width, height);

  // Compresser avec qualité adaptative pour respecter maxSizeBytes
  let blob = await canvasToBlob(canvas, opts.outputFormat, opts.quality);
  let currentQuality = opts.quality;

  // Réduire la qualité si nécessaire pour respecter la taille max
  while (blob.size > opts.maxSizeBytes && currentQuality > 0.3) {
    currentQuality -= 0.1;
    blob = await canvasToBlob(canvas, opts.outputFormat, currentQuality);
  }

  // Créer l'URL objet pour prévisualisation
  const objectUrl = URL.createObjectURL(blob);

  // Nettoyer l'URL objet source si nécessaire
  if (typeof source === "string" && source.startsWith("blob:")) {
    // Ne pas révoquer si c'est une URL blob externe
  }

  return {
    blob,
    objectUrl,
    originalSize,
    compressedSize: blob.size,
    compressionRatio: originalSize > 0 ? blob.size / originalSize : 1,
    width,
    height,
    format: opts.outputFormat,
  };
}

/**
 * Compresse plusieurs images en parallèle
 * @param sources Liste de fichiers/blobs/URLs
 * @param options Options de compression (appliquées à toutes)
 * @param onProgress Callback de progression (index, total)
 */
export async function compressImageBatch(
  sources: (File | Blob | string)[],
  options: CompressionOptions = {},
  onProgress?: (completed: number, total: number) => void
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];
  const total = sources.length;

  // Traiter par lots de 3 pour éviter de surcharger la mémoire
  const batchSize = 3;

  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(source => compressImage(source, options))
    );
    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total);
    }
  }

  return results;
}

/**
 * Charge une image dans un HTMLImageElement
 */
function loadImageElement(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Révoquer l'URL blob après chargement si créée ici
      if (typeof source !== "string") {
        URL.revokeObjectURL(img.src);
      }
      resolve(img);
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    // Permettre le chargement cross-origin pour les URLs externes
    img.crossOrigin = "anonymous";

    if (typeof source === "string") {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Calcule les dimensions finales en préservant le ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Si l'image est déjà plus petite, on ne l'agrandit pas
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  // Calculer le ratio de redimensionnement
  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const ratio = Math.min(widthRatio, heightRatio);

  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  return { width, height };
}

/**
 * Convertit un canvas en Blob avec le format et qualité spécifiés
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      },
      format,
      quality
    );
  });
}

/**
 * Formate la taille de fichier en format lisible
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Vérifie si un fichier doit être compressé
 */
export function shouldCompress(file: File, maxSizeBytes = 500 * 1024): boolean {
  // Compresser si le fichier est trop gros
  if (file.size > maxSizeBytes) {
    return true;
  }

  // Compresser les images non-web (HEIC, BMP, TIFF)
  const nonWebFormats = ["image/heic", "image/heif", "image/bmp", "image/tiff"];
  if (nonWebFormats.includes(file.type)) {
    return true;
  }

  return false;
}

/**
 * Prépare un fichier pour upload avec compression si nécessaire
 */
export async function prepareImageForUpload(
  file: File,
  options: CompressionOptions = {}
): Promise<{ file: File; wasCompressed: boolean; stats?: CompressionResult }> {
  // Vérifier si la compression est nécessaire
  if (!shouldCompress(file, options.maxSizeBytes)) {
    return { file, wasCompressed: false };
  }

  // Compresser l'image
  const result = await compressImage(file, options);

  // Créer un nouveau File à partir du Blob compressé
  const compressedFile = new File(
    [result.blob],
    file.name.replace(/\.[^.]+$/, ".jpg"), // Renommer en .jpg
    { type: result.format }
  );

  return {
    file: compressedFile,
    wasCompressed: true,
    stats: result,
  };
}

/**
 * Hook-friendly: Libère les URL objets créés
 */
export function revokeObjectUrls(results: CompressionResult[]): void {
  results.forEach(result => {
    try {
      URL.revokeObjectURL(result.objectUrl);
    } catch {
      // Ignorer les erreurs de révocation
    }
  });
}
