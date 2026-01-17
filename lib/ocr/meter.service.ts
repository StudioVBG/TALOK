/**
 * Service OCR spécialisé pour les compteurs d'énergie et d'eau
 * 
 * Optimisé pour la reconnaissance des afficheurs de compteurs :
 * - Linky (électricité)
 * - Gazpar (gaz)
 * - Compteurs d'eau
 * 
 * Utilise Tesseract.js (gratuit, local) avec configuration spécialisée
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';

export interface MeterOCRResult {
  /** Valeur numérique extraite du compteur */
  value: number | null;
  /** Unité détectée */
  unit: 'kWh' | 'm³' | 'L' | 'unknown';
  /** Pourcentage de confiance (0-100) */
  confidence: number;
  /** Texte brut extrait */
  rawText: string;
  /** Temps de traitement en ms */
  processingTimeMs: number;
  /** Si la valeur nécessite une validation humaine */
  needsValidation: boolean;
  /** Message d'erreur si applicable */
  error?: string;
}

export interface MeterType {
  type: 'electricity' | 'gas' | 'water';
  expectedDigits: number;
  unit: 'kWh' | 'm³' | 'L';
  maxValue: number;
}

const METER_CONFIGS: Record<string, MeterType> = {
  electricity: {
    type: 'electricity',
    expectedDigits: 6, // Typiquement 5-6 chiffres pour Linky
    unit: 'kWh',
    maxValue: 999999,
  },
  gas: {
    type: 'gas',
    expectedDigits: 5, // Typiquement 5 chiffres pour Gazpar
    unit: 'm³',
    maxValue: 99999,
  },
  water: {
    type: 'water',
    expectedDigits: 5,
    unit: 'm³',
    maxValue: 99999,
  },
};

// Seuil de confiance minimum pour validation automatique
const AUTO_VALIDATION_THRESHOLD = 80;

class MeterOCRService {
  private workerPromise: Promise<Tesseract.Worker> | null = null;

  /**
   * Initialiser le worker Tesseract optimisé pour les chiffres
   */
  private async getWorker(): Promise<Tesseract.Worker> {
    if (!this.workerPromise) {
      console.log('[MeterOCR] Initialisation du worker OCR...');
      this.workerPromise = Tesseract.createWorker('eng', 1, {
        // Logger pour debug (décommenter si besoin)
        // logger: (m) => console.log('[MeterOCR]', m.status, m.progress),
      });
    }
    return this.workerPromise;
  }

  /**
   * Prétraiter l'image pour optimiser la reconnaissance des chiffres de compteur
   */
  private async preprocessMeterImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      console.log('[MeterOCR] Prétraitement de l\'image...');
      
      return await sharp(imageBuffer)
        // Redimensionner pour une résolution optimale OCR
        .resize(1200, null, { 
          withoutEnlargement: false,
          fit: 'inside' 
        })
        // Convertir en niveaux de gris
        .grayscale()
        // Augmenter le contraste (important pour les afficheurs LCD)
        .normalise()
        // Seuillage adaptatif pour isoler les chiffres
        .threshold(128)
        // Améliorer la netteté
        .sharpen({ sigma: 2 })
        // Réduire le bruit
        .median(1)
        // Format PNG pour qualité optimale
        .png()
        .toBuffer();
    } catch (error) {
      console.warn('[MeterOCR] Prétraitement échoué, utilisation image originale:', error);
      return imageBuffer;
    }
  }

  /**
   * Analyser une photo de compteur et extraire la valeur
   */
  async analyzeMeterPhoto(
    imageBuffer: Buffer,
    meterType: 'electricity' | 'gas' | 'water' = 'electricity'
  ): Promise<MeterOCRResult> {
    const startTime = Date.now();
    console.log(`[MeterOCR] Analyse compteur ${meterType}...`);

    try {
      // Prétraitement de l'image
      const processedImage = await this.preprocessMeterImage(imageBuffer);

      // Obtenir le worker
      const worker = await this.getWorker();
      
      // Configuration optimisée pour les compteurs : uniquement chiffres et décimales
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789.,',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, // Mode ligne unique
      });

      // Reconnaissance OCR
      const { data } = await worker.recognize(processedImage);
      
      const processingTimeMs = Date.now() - startTime;
      console.log(`[MeterOCR] OCR terminé en ${processingTimeMs}ms, confiance: ${data.confidence.toFixed(1)}%`);

      // Extraire la valeur numérique
      const config = METER_CONFIGS[meterType];
      const extractedValue = this.extractMeterValue(data.text, config);

      // Déterminer si validation humaine nécessaire
      const needsValidation = 
        data.confidence < AUTO_VALIDATION_THRESHOLD ||
        extractedValue.value === null ||
        (extractedValue.value !== null && extractedValue.value > config.maxValue);

      return {
        value: extractedValue.value,
        unit: config.unit,
        confidence: data.confidence,
        rawText: data.text,
        processingTimeMs,
        needsValidation,
      };

    } catch (error: unknown) {
      console.error('[MeterOCR] Erreur:', error.message);
      return {
        value: null,
        unit: 'unknown',
        confidence: 0,
        rawText: '',
        processingTimeMs: Date.now() - startTime,
        needsValidation: true,
        error: error.message,
      };
    }
  }

  /**
   * Extraire la valeur numérique du texte OCR
   */
  private extractMeterValue(
    text: string, 
    config: MeterType
  ): { value: number | null; rawMatch: string | null } {
    // Nettoyer le texte
    const cleaned = text
      .replace(/\s/g, '')      // Supprimer espaces
      .replace(/,/g, '.')      // Remplacer virgules par points
      .replace(/[oO]/g, '0')   // Corriger O → 0 (erreur courante)
      .replace(/[lI]/g, '1')   // Corriger l/I → 1 (erreur courante)
      .replace(/[sS]/g, '5')   // Corriger S → 5 (erreur courante)
      .replace(/[bB]/g, '8');  // Corriger B → 8 (erreur courante)

    console.log(`[MeterOCR] Texte nettoyé: "${cleaned}"`);

    // Patterns selon le nombre de chiffres attendus
    const patterns = [
      // Pattern avec décimales
      new RegExp(`(\\d{${config.expectedDigits - 1},${config.expectedDigits + 1}}(?:\\.\\d{1,3})?)`),
      // Pattern sans décimales
      new RegExp(`(\\d{${config.expectedDigits - 1},${config.expectedDigits + 1}})`),
      // Pattern plus large (4-8 chiffres)
      /(\d{4,8}(?:\.\d{1,3})?)/,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        // Vérifier que la valeur est dans les limites raisonnables
        if (value >= 0 && value <= config.maxValue) {
          console.log(`[MeterOCR] Valeur extraite: ${value} ${config.unit}`);
          return { value, rawMatch: match[1] };
        }
      }
    }

    console.log('[MeterOCR] Aucune valeur valide trouvée');
    return { value: null, rawMatch: null };
  }

  /**
   * Valider manuellement une valeur OCR
   * Compare la valeur corrigée avec la valeur OCR pour apprentissage futur
   */
  validateReading(
    ocrValue: number | null,
    correctedValue: number,
    meterType: 'electricity' | 'gas' | 'water'
  ): { isValid: boolean; correction: number | null } {
    if (ocrValue === null) {
      return { isValid: true, correction: null };
    }

    const diff = Math.abs(ocrValue - correctedValue);
    const percentDiff = (diff / correctedValue) * 100;

    // Si différence > 10%, loguer pour amélioration future
    if (percentDiff > 10) {
      console.log(`[MeterOCR] Correction importante: OCR=${ocrValue}, Corrigé=${correctedValue}, Diff=${percentDiff.toFixed(1)}%`);
    }

    return {
      isValid: true,
      correction: diff > 0 ? diff : null,
    };
  }

  /**
   * Terminer le worker et libérer les ressources
   */
  async terminate(): Promise<void> {
    if (this.workerPromise) {
      console.log('[MeterOCR] Arrêt du worker OCR...');
      const worker = await this.workerPromise;
      await worker.terminate();
      this.workerPromise = null;
    }
  }
}

// Export singleton
export const meterOCRService = new MeterOCRService();

// Export classe pour tests
export { MeterOCRService };

