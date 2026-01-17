/**
 * Service OCR interne avec Tesseract.js
 * 100% gratuit - pas de limite d'utilisation
 * 
 * Spécialisé pour l'extraction des données des CNI françaises
 * 
 * Avantages:
 * - Gratuit et open source
 * - Pas de clé API requise
 * - Données restent en local (confidentialité)
 * - Fonctionne hors ligne
 * 
 * Limitations:
 * - Précision ~70-85% vs ~95% pour Mindee
 * - Plus lent (2-5s vs <1s)
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { validateMRZ, detectMRZFraud, type MRZValidationResult } from './mrz-validator';

export interface InternalIdCardData {
  documentType: "cni" | "passport" | "titre_sejour" | "permis" | "other";
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  gender?: string;
  nationality?: string;
  documentNumber?: string;
  expiryDate?: string;
  issueDate?: string;
  mrz?: string;
  mrzValidation?: MRZValidationResult;
  mrzFraudCheck?: { suspiciousFraud: boolean; reasons: string[]; riskScore: number };
  rawText: string;
  confidence: number;
  isValid: boolean;
  requiresManualVerification?: boolean;
}

class TesseractOCRService {
  private workerPromise: Promise<Tesseract.Worker> | null = null;

  /**
   * Initialiser le worker Tesseract avec le français
   */
  private async getWorker(): Promise<Tesseract.Worker> {
    if (!this.workerPromise) {
      console.log('[Tesseract] Initialisation du worker OCR français...');
      this.workerPromise = Tesseract.createWorker('fra', 1, {
        // Logger désactivé en production, activer pour debug:
        // logger: (m) => console.log('[Tesseract]', m.status, m.progress),
      });
    }
    return this.workerPromise;
  }

  /**
   * Prétraiter l'image pour améliorer la reconnaissance OCR
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      console.log('[Tesseract] Prétraitement de l\'image...');
      
      return await sharp(imageBuffer)
        // Redimensionner si trop petit (min 1200px de large pour bonne qualité)
        .resize(1400, null, { 
          withoutEnlargement: false,
          fit: 'inside' 
        })
        // Convertir en niveaux de gris (améliore la reconnaissance)
        .grayscale()
        // Normaliser l'histogramme (améliore le contraste)
        .normalise()
        // Légère amélioration de la netteté
        .sharpen({ sigma: 1.5 })
        // Réduire le bruit
        .median(1)
        // Format PNG pour qualité optimale
        .png()
        .toBuffer();
    } catch (error) {
      console.warn('[Tesseract] Prétraitement échoué, utilisation image originale:', error);
      return imageBuffer;
    }
  }

  /**
   * Analyser une pièce d'identité française
   */
  async analyzeIdCard(
    imageBuffer: Buffer,
    fileName: string = "id.jpg"
  ): Promise<InternalIdCardData> {
    console.log('[Tesseract] Début analyse OCR...');
    const startTime = Date.now();

    try {
      // Prétraiter l'image pour meilleure reconnaissance
      const processedImage = await this.preprocessImage(imageBuffer);

      // Reconnaissance OCR
      const worker = await this.getWorker();
      const { data } = await worker.recognize(processedImage);
      
      const rawText = data.text;
      const confidence = data.confidence / 100; // Normaliser entre 0 et 1

      const duration = Date.now() - startTime;
      console.log(`[Tesseract] Extraction terminée en ${duration}ms, confiance: ${(confidence * 100).toFixed(1)}%`);

      // Extraire les champs depuis le texte brut
      const extractedData = this.extractFieldsFromText(rawText);

      return {
        documentType: extractedData.documentType || "cni",
        firstName: extractedData.firstName,
        lastName: extractedData.lastName,
        birthDate: extractedData.birthDate,
        birthPlace: extractedData.birthPlace,
        gender: extractedData.gender,
        nationality: extractedData.nationality,
        documentNumber: extractedData.documentNumber,
        expiryDate: extractedData.expiryDate,
        mrz: extractedData.mrz,
        mrzValidation: extractedData.mrzValidation,
        mrzFraudCheck: extractedData.mrzFraudCheck,
        rawText,
        confidence,
        isValid: confidence > 0.5 && (!!extractedData.lastName || !!extractedData.documentNumber),
        requiresManualVerification: extractedData.requiresManualVerification,
      };

    } catch (error: unknown) {
      console.error('[Tesseract] Erreur OCR:', error.message);
      return {
        documentType: "other",
        rawText: "",
        confidence: 0,
        isValid: false,
      };
    }
  }

  /**
   * Extraire les champs depuis le texte brut d'un document d'identité
   * Supporte : CNI, Passeport, Titre de séjour, Permis de conduire
   */
  private extractFieldsFromText(text: string): Partial<InternalIdCardData> {
    // Normaliser le texte pour la recherche
    const normalizedText = text.toUpperCase().replace(/\s+/g, ' ');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    console.log('[Tesseract] Extraction des champs depuis le texte...');

    // Détecter le type de document
    const detectedType = this.detectDocumentType(normalizedText);
    const result: Partial<InternalIdCardData> = {
      documentType: detectedType,
    };
    
    console.log(`[Tesseract] Type de document détecté: ${detectedType}`);

    // ==== EXTRACTION DU NOM ====
    // Patterns pour trouver le nom de famille
    const nomPatterns = [
      /NOM\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,30})/,
      /SURNAME\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,30})/,
    ];
    
    for (const pattern of nomPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        result.lastName = this.cleanName(match[1]);
        break;
      }
    }

    // ==== EXTRACTION DU PRÉNOM ====
    const prenomPatterns = [
      /PR[EÉ]NOM[S]?\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s,]{2,50})/,
      /GIVEN\s*NAME[S]?\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s,]{2,50})/,
      /FIRST\s*NAME[S]?\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s,]{2,50})/,
    ];
    
    for (const pattern of prenomPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        result.firstName = this.cleanName(match[1]);
        break;
      }
    }

    // ==== DATE DE NAISSANCE ====
    // Formats: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
    const datePatterns = [
      /N[EÉ]\(?E?\)?\s*LE\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /DATE\s*(?:DE\s*)?NAISSANCE\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /BORN\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /(\d{2}[\.\/-]\d{2}[\.\/-](?:19|20)\d{2})/, // Pattern générique avec années 19xx ou 20xx
    ];
    
    for (const pattern of datePatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        result.birthDate = this.formatDate(match[1]);
        break;
      }
    }

    // ==== LIEU DE NAISSANCE ====
    const lieuPatterns = [
      /[AÀ]\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,40})\s*\((\d{2,5})\)/,
      /LIEU\s*(?:DE\s*)?NAISSANCE\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,40})/,
      /BIRTH\s*PLACE\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,40})/,
    ];
    
    for (const pattern of lieuPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        result.birthPlace = this.cleanName(match[1]);
        break;
      }
    }

    // ==== SEXE ====
    // Chercher M ou F isolé, ou MASCULIN/FEMININ
    if (/\bSEXE\s*[:\-]?\s*M\b|\bMASCULIN\b|\bMALE\b/i.test(normalizedText)) {
      result.gender = 'M';
    } else if (/\bSEXE\s*[:\-]?\s*F\b|\bF[EÉ]MININ\b|\bFEMALE\b/i.test(normalizedText)) {
      result.gender = 'F';
    } else if (/\bM\b/.test(normalizedText) && !/\bF\b/.test(normalizedText.substring(0, 500))) {
      result.gender = 'M';
    } else if (/\bF\b/.test(normalizedText.substring(0, 500))) {
      result.gender = 'F';
    }

    // ==== NATIONALITÉ ====
    if (/FRAN[CÇ]AISE|FRENCH|NATIONALIT[EÉ]\s*[:\-]?\s*FR/i.test(normalizedText)) {
      result.nationality = 'FRANÇAISE';
    }

    // ==== NUMÉRO DE CNI ====
    // Format CNI française: 12 caractères alphanumériques
    const numPatterns = [
      /N[°O]?\s*(?:DE\s*)?(?:CARTE|CNI|ID)\s*[:\-]?\s*([A-Z0-9]{9,14})/,
      /CARD\s*N[°O]?\s*[:\-]?\s*([A-Z0-9]{9,14})/,
      /\b([A-Z]{2}\d{7}[A-Z0-9]{3})\b/, // Format CNI: 2 lettres + 7 chiffres + 3 alphanum
      /\b(\d{12})\b/, // 12 chiffres
    ];
    
    for (const pattern of numPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1].length >= 9) {
        result.documentNumber = match[1];
        break;
      }
    }

    // ==== DATE D'EXPIRATION ====
    const expiryPatterns = [
      /VALABLE\s*JUSQU['\s]?AU\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /VALID\s*UNTIL\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /EXPIR[EY]\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /DATE\s*(?:DE\s*)?FIN\s*(?:DE\s*)?VALIDIT[EÉ]\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
    ];
    
    for (const pattern of expiryPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        result.expiryDate = this.formatDate(match[1]);
        break;
      }
    }

    // ==== MRZ (Machine Readable Zone) ====
    // 2 lignes de 30, 36 ou 44 caractères avec < comme séparateur
    const mrzPattern = /([A-Z0-9<]{28,44})\s*\n?\s*([A-Z0-9<]{28,44})/;
    const mrzMatch = text.match(mrzPattern);
    if (mrzMatch) {
      const mrzText = `${mrzMatch[1]}\n${mrzMatch[2]}`;
      result.mrz = mrzText;
      
      // Valider la MRZ avec le validateur ICAO 9303
      try {
        const mrzValidation = validateMRZ(mrzText);
        result.mrzValidation = mrzValidation;
        
        // Vérifier la fraude potentielle
        const fraudCheck = detectMRZFraud(mrzText);
        result.mrzFraudCheck = fraudCheck;
        
        // Extraire données depuis MRZ validée (priorité sur OCR texte)
        if (mrzValidation.valid || mrzValidation.confidence > 0.5) {
          const mrzData = mrzValidation.extractedData;
          
          if (mrzData.lastName && !result.lastName) {
            result.lastName = mrzData.lastName;
          }
          if (mrzData.firstName && !result.firstName) {
            result.firstName = mrzData.firstName;
          }
          if (mrzData.birthDate && !result.birthDate) {
            result.birthDate = mrzData.birthDate;
          }
          if (mrzData.documentNumber && !result.documentNumber) {
            result.documentNumber = mrzData.documentNumber;
          }
          if (mrzData.expiryDate && !result.expiryDate) {
            result.expiryDate = mrzData.expiryDate;
          }
          if (mrzData.nationality && !result.nationality) {
            result.nationality = mrzData.nationality;
          }
          if (mrzData.sex) {
            result.gender = mrzData.sex;
          }
        }
        
        // Marquer comme nécessitant vérification manuelle si fraude suspectée
        if (fraudCheck.suspiciousFraud) {
          result.requiresManualVerification = true;
          console.warn('[Tesseract] ⚠️ Fraude MRZ suspectée:', fraudCheck.reasons);
        }
      } catch (mrzError) {
        console.warn('[Tesseract] Erreur validation MRZ:', mrzError);
        // Fallback sur extraction simple si le validateur échoue
        if (!result.lastName) {
          const mrzLine1 = mrzMatch[1];
          if (mrzLine1.length > 5) {
            const namePart = mrzLine1.substring(5, 30).split('<<')[0];
            const cleanedName = namePart.replace(/</g, ' ').trim();
            if (cleanedName && cleanedName.length > 1) {
              result.lastName = cleanedName;
            }
          }
        }
        
        if (!result.firstName) {
          const mrzLine1 = mrzMatch[1];
          const parts = mrzLine1.split('<<');
          if (parts.length > 1 && parts[1]) {
            const firstNamePart = parts[1].replace(/</g, ' ').trim();
            if (firstNamePart && firstNamePart.length > 1) {
              result.firstName = firstNamePart.split(' ')[0];
            }
          }
        }
      }
    }

    // Log des champs extraits
    const extractedCount = Object.keys(result).filter(k => 
      k !== 'documentType' && result[k as keyof typeof result]
    ).length;
    console.log(`[Tesseract] ${extractedCount} champs extraits:`, 
      Object.entries(result)
        .filter(([k, v]) => k !== 'documentType' && v)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v.substring(0, 20) : v}`)
        .join(', ')
    );

    return result;
  }

  /**
   * Nettoyer un nom extrait (enlever caractères parasites)
   */
  private cleanName(name: string): string {
    return name
      // Garder uniquement les lettres, tirets et espaces
      .replace(/[^A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]/gi, '')
      // Normaliser les espaces
      .replace(/\s+/g, ' ')
      .trim()
      // Prendre max 4 mots
      .split(' ')
      .filter(Boolean)
      .slice(0, 4)
      .join(' ');
  }

  /**
   * Formater une date en ISO (YYYY-MM-DD)
   */
  private formatDate(dateStr: string): string {
    const parts = dateStr.split(/[\.\/-]/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      // Vérifier que c'est une date valide
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return dateStr;
  }

  /**
   * Détecter le type de document d'identité à partir du texte
   */
  private detectDocumentType(text: string): InternalIdCardData["documentType"] {
    const upperText = text.toUpperCase();
    
    // Passeport
    if (/PASSEPORT|PASSPORT|TRAVEL\s*DOCUMENT/i.test(upperText)) {
      return "passport";
    }
    
    // Titre de séjour / Carte de séjour
    if (/TITRE\s*DE\s*S[EÉ]JOUR|CARTE\s*DE\s*S[EÉ]JOUR|RESIDENCE\s*PERMIT|AUTORISATION\s*DE\s*S[EÉ]JOUR/i.test(upperText)) {
      return "titre_sejour";
    }
    
    // Permis de conduire
    if (/PERMIS\s*DE\s*CONDUIRE|DRIVING\s*LICEN[CS]E|PERMIS\s*B|CAT[EÉ]GORIE\s*[ABCDE]/i.test(upperText)) {
      return "permis";
    }
    
    // CNI (par défaut si mention de carte d'identité ou format français)
    if (/CARTE\s*(?:NATIONALE\s*)?D['']?IDENTIT[EÉ]|IDENTITY\s*CARD|IDFRA|R[EÉ]PUBLIQUE\s*FRAN[CÇ]AISE/i.test(upperText)) {
      return "cni";
    }
    
    // Détecter via MRZ
    if (/^P[A-Z<]|^ID[A-Z<]|^I<[A-Z<]/m.test(upperText)) {
      // MRZ détectée - analyser le premier caractère
      if (/^P[A-Z<]/m.test(upperText)) {
        return "passport";
      }
      return "cni";
    }
    
    // Par défaut
    return "cni";
  }

  /**
   * Terminer le worker (libérer la mémoire)
   * Appeler quand l'application se termine
   */
  async terminate(): Promise<void> {
    if (this.workerPromise) {
      console.log('[Tesseract] Arrêt du worker OCR...');
      const worker = await this.workerPromise;
      await worker.terminate();
      this.workerPromise = null;
    }
  }
}

// Export singleton pour usage global
export const tesseractOCRService = new TesseractOCRService();

// Export classe pour tests ou instances multiples
export { TesseractOCRService };






