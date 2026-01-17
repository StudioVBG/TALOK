/**
 * Utilitaires de détection de qualité d'image pour les documents d'identité
 * Vérifie : flou, luminosité, contraste, et présence de document
 */

export interface ImageQualityResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ImageQualityIssue[];
  suggestions: string[];
}

export interface ImageQualityIssue {
  type: "blur" | "dark" | "bright" | "low_contrast" | "no_document" | "too_small";
  severity: "warning" | "error";
  message: string;
}

/**
 * Analyse la qualité d'une image capturée (côté client)
 * Utilise Canvas pour l'analyse
 */
export async function analyzeImageQuality(
  imageSource: string | Blob,
  options: {
    minWidth?: number;
    minHeight?: number;
    checkBlur?: boolean;
    checkBrightness?: boolean;
  } = {}
): Promise<ImageQualityResult> {
  const {
    minWidth = 640,
    minHeight = 480,
    checkBlur = true,
    checkBrightness = true,
  } = options;

  const issues: ImageQualityIssue[] = [];
  const suggestions: string[] = [];
  let score = 100;

  try {
    // Charger l'image dans un canvas
    const image = await loadImage(imageSource);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas 2D non disponible");
    }

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    // 1. Vérifier la taille minimale
    if (image.width < minWidth || image.height < minHeight) {
      issues.push({
        type: "too_small",
        severity: "error",
        message: `Image trop petite (${image.width}x${image.height}px, min: ${minWidth}x${minHeight}px)`,
      });
      suggestions.push("Rapprochez-vous du document ou utilisez une meilleure caméra");
      score -= 30;
    }

    // Obtenir les données de pixels
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // 2. Analyser la luminosité
    if (checkBrightness) {
      const brightnessResult = analyzeBrightness(pixels);
      
      if (brightnessResult.avgBrightness < 50) {
        issues.push({
          type: "dark",
          severity: "warning",
          message: `Image trop sombre (luminosité: ${brightnessResult.avgBrightness.toFixed(0)}%)`,
        });
        suggestions.push("Augmentez l'éclairage ou activez le flash");
        score -= 20;
      } else if (brightnessResult.avgBrightness > 220) {
        issues.push({
          type: "bright",
          severity: "warning",
          message: `Image trop claire/surexposée (luminosité: ${brightnessResult.avgBrightness.toFixed(0)}%)`,
        });
        suggestions.push("Réduisez l'éclairage ou évitez les reflets");
        score -= 15;
      }

      // 3. Analyser le contraste
      if (brightnessResult.contrast < 30) {
        issues.push({
          type: "low_contrast",
          severity: "warning",
          message: "Contraste insuffisant",
        });
        suggestions.push("Assurez-vous que le document est bien visible");
        score -= 10;
      }
    }

    // 4. Détecter le flou (Laplacien)
    if (checkBlur) {
      const blurScore = detectBlur(imageData, canvas.width, canvas.height);
      
      if (blurScore < 100) {
        issues.push({
          type: "blur",
          severity: blurScore < 50 ? "error" : "warning",
          message: `Image floue (netteté: ${blurScore.toFixed(0)}/500)`,
        });
        suggestions.push("Tenez votre appareil stable et assurez-vous que la mise au point est faite");
        score -= blurScore < 50 ? 30 : 15;
      }
    }

    // Score minimum de 0
    score = Math.max(0, score);

    return {
      isValid: issues.filter(i => i.severity === "error").length === 0 && score >= 50,
      score,
      issues,
      suggestions: [...new Set(suggestions)], // Dédupliquer
    };
  } catch (error: unknown) {
    console.error("[ImageQuality] Erreur analyse:", error);
    return {
      isValid: true, // On laisse passer si l'analyse échoue
      score: 50,
      issues: [],
      suggestions: [],
    };
  }
}

/**
 * Charger une image depuis une URL ou un Blob
 */
function loadImage(source: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    
    if (typeof source === "string") {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Analyser la luminosité et le contraste
 */
function analyzeBrightness(pixels: Uint8ClampedArray): { 
  avgBrightness: number; 
  contrast: number;
} {
  let totalBrightness = 0;
  let minBrightness = 255;
  let maxBrightness = 0;
  const pixelCount = pixels.length / 4;

  for (let i = 0; i < pixels.length; i += 4) {
    // Calcul de la luminance perçue (formule ITU-R BT.709)
    const brightness = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    totalBrightness += brightness;
    minBrightness = Math.min(minBrightness, brightness);
    maxBrightness = Math.max(maxBrightness, brightness);
  }

  return {
    avgBrightness: totalBrightness / pixelCount,
    contrast: maxBrightness - minBrightness,
  };
}

/**
 * Détecter le flou avec le Laplacien (variance)
 * Plus la variance est faible, plus l'image est floue
 */
function detectBlur(imageData: ImageData, width: number, height: number): number {
  const gray = new Float32Array(width * height);
  const pixels = imageData.data;

  // Convertir en niveaux de gris
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
  }

  // Appliquer le Laplacien et calculer la variance
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  // Kernel Laplacien 3x3: [[0,1,0],[1,-4,1],[0,1,0]]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        -4 * gray[idx] +
        gray[idx - 1] + // gauche
        gray[idx + 1] + // droite
        gray[idx - width] + // haut
        gray[idx + width]; // bas

      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  // Variance = E[X²] - E[X]²
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;

  // Normaliser le score (variance typique d'une image nette: 500-2000+)
  return variance;
}

/**
 * Vérification rapide côté client avant upload
 * Retourne true si l'image est acceptable, false sinon
 */
export async function quickQualityCheck(imageSource: string | Blob): Promise<{
  ok: boolean;
  message?: string;
}> {
  const result = await analyzeImageQuality(imageSource, {
    minWidth: 480,
    minHeight: 320,
    checkBlur: true,
    checkBrightness: true,
  });

  if (!result.isValid) {
    const errorIssue = result.issues.find(i => i.severity === "error");
    const suggestion = result.suggestions[0];
    
    return {
      ok: false,
      message: errorIssue?.message || suggestion || "Qualité d'image insuffisante",
    };
  }

  return { ok: true };
}

