/**
 * Validateur MRZ (Machine Readable Zone) conforme ICAO 9303
 * 
 * Supporte :
 * - CNI française (ID-2, 2 lignes de 36 caractères)
 * - Passeport (TD3, 2 lignes de 44 caractères)
 * - Carte de séjour (ID-1, 3 lignes de 30 caractères)
 * 
 * Référence : ICAO Doc 9303 Part 3-5
 */

export interface MRZValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  documentType: "ID" | "PASSPORT" | "RESIDENCE_PERMIT" | "UNKNOWN";
  extractedData: {
    lastName?: string;
    firstName?: string;
    documentNumber?: string;
    nationality?: string;
    birthDate?: string; // Format YYYY-MM-DD
    sex?: "M" | "F" | "X";
    expiryDate?: string; // Format YYYY-MM-DD
    personalNumber?: string;
    issuingCountry?: string;
  };
  checksums: {
    documentNumber: { expected: number; actual: number; valid: boolean };
    birthDate: { expected: number; actual: number; valid: boolean };
    expiryDate: { expected: number; actual: number; valid: boolean };
    overall?: { expected: number; actual: number; valid: boolean };
  };
  confidence: number; // 0-1
}

/**
 * Table de conversion des caractères MRZ en valeurs numériques
 * Conforme ICAO 9303
 */
const MRZ_CHAR_VALUES: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4,
  "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "A": 10, "B": 11, "C": 12, "D": 13, "E": 14,
  "F": 15, "G": 16, "H": 17, "I": 18, "J": 19,
  "K": 20, "L": 21, "M": 22, "N": 23, "O": 24,
  "P": 25, "Q": 26, "R": 27, "S": 28, "T": 29,
  "U": 30, "V": 31, "W": 32, "X": 33, "Y": 34,
  "Z": 35, "<": 0,
};

/**
 * Poids pour le calcul du checksum (séquence 7-3-1 répétée)
 */
const WEIGHTS = [7, 3, 1];

/**
 * Calcule le checksum MRZ selon l'algorithme ICAO 9303
 * @param str Chaîne à vérifier
 * @returns Checksum (0-9)
 */
export function calculateMRZChecksum(str: string): number {
  let sum = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i].toUpperCase();
    const value = MRZ_CHAR_VALUES[char];
    
    if (value === undefined) {
      // Caractère invalide, traiter comme <
      sum += 0;
    } else {
      sum += value * WEIGHTS[i % 3];
    }
  }
  
  return sum % 10;
}

/**
 * Valide une MRZ complète et extrait les données
 * @param mrz Chaîne MRZ (peut contenir des retours à la ligne)
 * @returns Résultat de validation avec données extraites
 */
export function validateMRZ(mrz: string): MRZValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const extractedData: MRZValidationResult["extractedData"] = {};
  const checksums: MRZValidationResult["checksums"] = {
    documentNumber: { expected: 0, actual: 0, valid: false },
    birthDate: { expected: 0, actual: 0, valid: false },
    expiryDate: { expected: 0, actual: 0, valid: false },
  };

  // Normaliser la MRZ
  const normalizedMRZ = mrz
    .toUpperCase()
    .replace(/[^A-Z0-9<\n]/g, "")
    .trim();
  
  const lines = normalizedMRZ.split("\n").filter(l => l.length > 0);
  
  // Détecter le type de document
  let documentType: MRZValidationResult["documentType"] = "UNKNOWN";
  
  if (lines.length === 2) {
    if (lines[0].length === 44 && lines[1].length === 44) {
      documentType = "PASSPORT";
    } else if (lines[0].length === 36 && lines[1].length === 36) {
      documentType = "ID";
    } else if (lines[0].length === 30 && lines[1].length === 30) {
      documentType = "RESIDENCE_PERMIT";
    }
  } else if (lines.length === 3 && lines.every(l => l.length === 30)) {
    documentType = "RESIDENCE_PERMIT";
  }

  if (documentType === "UNKNOWN") {
    errors.push(`Format MRZ non reconnu: ${lines.length} ligne(s), longueurs: ${lines.map(l => l.length).join(", ")}`);
    return {
      valid: false,
      errors,
      warnings,
      documentType,
      extractedData,
      checksums,
      confidence: 0,
    };
  }

  // Valider selon le type
  if (documentType === "ID" || documentType === "RESIDENCE_PERMIT") {
    return validateIDCard(lines, documentType, errors, warnings);
  } else {
    return validatePassport(lines, errors, warnings);
  }
}

/**
 * Valide une CNI française (format ID-2)
 */
function validateIDCard(
  lines: string[],
  documentType: "ID" | "RESIDENCE_PERMIT",
  errors: string[],
  warnings: string[]
): MRZValidationResult {
  const extractedData: MRZValidationResult["extractedData"] = {};
  const checksums: MRZValidationResult["checksums"] = {
    documentNumber: { expected: 0, actual: 0, valid: false },
    birthDate: { expected: 0, actual: 0, valid: false },
    expiryDate: { expected: 0, actual: 0, valid: false },
  };

  const line1 = lines[0];
  const line2 = lines[1];
  const expectedLength = documentType === "ID" ? 36 : 30;

  // Vérifier les longueurs
  if (line1.length !== expectedLength) {
    errors.push(`Ligne 1: longueur ${line1.length} au lieu de ${expectedLength}`);
  }
  if (line2.length !== expectedLength) {
    errors.push(`Ligne 2: longueur ${line2.length} au lieu de ${expectedLength}`);
  }

  // === LIGNE 1 ===
  // Format CNI française: IDFRA[NOM<<<<<<<<<<<<<<<<<<<<<][PRENOM<<<<<<<<]
  
  // Type de document (positions 0-1)
  const docTypeCode = line1.substring(0, 2);
  if (!["ID", "I<", "AC", "IP"].includes(docTypeCode)) {
    warnings.push(`Type de document inhabituel: ${docTypeCode}`);
  }

  // Pays émetteur (positions 2-4)
  extractedData.issuingCountry = line1.substring(2, 5).replace(/</g, "");

  // Nom et prénom (positions 5+)
  const namePart = line1.substring(5);
  const nameParts = namePart.split("<<");
  
  if (nameParts.length >= 1) {
    extractedData.lastName = nameParts[0].replace(/</g, " ").trim();
  }
  if (nameParts.length >= 2) {
    extractedData.firstName = nameParts[1].replace(/</g, " ").trim();
  }

  // === LIGNE 2 ===
  // Format: [NUM_DOC(12)][CHECK][NAT(3)][DDN(6)][CHECK][SEX][EXP(6)][CHECK][OPT(14)][CHECK_GLOBAL]
  
  // Numéro de document (positions 0-11 pour CNI française 36 car)
  let docNumEnd = 12;
  if (expectedLength === 30) {
    docNumEnd = 9;
  }
  
  extractedData.documentNumber = line2.substring(0, docNumEnd).replace(/</g, "");
  const docNumCheck = parseInt(line2[docNumEnd], 10);
  const docNumCalculated = calculateMRZChecksum(line2.substring(0, docNumEnd));
  
  checksums.documentNumber = {
    expected: docNumCheck,
    actual: docNumCalculated,
    valid: docNumCheck === docNumCalculated,
  };
  
  if (!checksums.documentNumber.valid) {
    errors.push(`Checksum numéro de document invalide: attendu ${docNumCheck}, calculé ${docNumCalculated}`);
  }

  // Nationalité (après checksum doc)
  const natStart = docNumEnd + 1;
  extractedData.nationality = line2.substring(natStart, natStart + 3).replace(/</g, "");

  // Date de naissance (6 caractères AAMMJJ)
  const dobStart = natStart + 3;
  const dobStr = line2.substring(dobStart, dobStart + 6);
  const dobCheck = parseInt(line2[dobStart + 6], 10);
  const dobCalculated = calculateMRZChecksum(dobStr);
  
  checksums.birthDate = {
    expected: dobCheck,
    actual: dobCalculated,
    valid: dobCheck === dobCalculated,
  };
  
  if (!checksums.birthDate.valid) {
    errors.push(`Checksum date de naissance invalide: attendu ${dobCheck}, calculé ${dobCalculated}`);
  }

  // Convertir la date de naissance
  extractedData.birthDate = parseMRZDate(dobStr);

  // Sexe
  const sexPos = dobStart + 7;
  const sex = line2[sexPos];
  if (sex === "M" || sex === "F") {
    extractedData.sex = sex;
  } else if (sex === "<" || sex === "X") {
    extractedData.sex = "X";
  } else {
    warnings.push(`Sexe non reconnu: ${sex}`);
  }

  // Date d'expiration
  const expStart = sexPos + 1;
  const expStr = line2.substring(expStart, expStart + 6);
  const expCheck = parseInt(line2[expStart + 6], 10);
  const expCalculated = calculateMRZChecksum(expStr);
  
  checksums.expiryDate = {
    expected: expCheck,
    actual: expCalculated,
    valid: expCheck === expCalculated,
  };
  
  if (!checksums.expiryDate.valid) {
    errors.push(`Checksum date d'expiration invalide: attendu ${expCheck}, calculé ${expCalculated}`);
  }

  extractedData.expiryDate = parseMRZDate(expStr);

  // Vérifier si le document est expiré
  if (extractedData.expiryDate) {
    const expDate = new Date(extractedData.expiryDate);
    if (expDate < new Date()) {
      warnings.push(`Document expiré depuis le ${extractedData.expiryDate}`);
    }
  }

  // Calculer la confiance globale
  const validChecksums = [
    checksums.documentNumber.valid,
    checksums.birthDate.valid,
    checksums.expiryDate.valid,
  ].filter(Boolean).length;
  
  const confidence = errors.length === 0 
    ? (validChecksums / 3) * 0.9 + 0.1 
    : Math.max(0, (validChecksums / 3) * 0.5);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    documentType,
    extractedData,
    checksums,
    confidence,
  };
}

/**
 * Valide un passeport (format TD3)
 */
function validatePassport(
  lines: string[],
  errors: string[],
  warnings: string[]
): MRZValidationResult {
  const extractedData: MRZValidationResult["extractedData"] = {};
  const checksums: MRZValidationResult["checksums"] = {
    documentNumber: { expected: 0, actual: 0, valid: false },
    birthDate: { expected: 0, actual: 0, valid: false },
    expiryDate: { expected: 0, actual: 0, valid: false },
  };

  const line1 = lines[0];
  const line2 = lines[1];

  // Vérifier les longueurs
  if (line1.length !== 44) {
    errors.push(`Ligne 1: longueur ${line1.length} au lieu de 44`);
  }
  if (line2.length !== 44) {
    errors.push(`Ligne 2: longueur ${line2.length} au lieu de 44`);
  }

  // === LIGNE 1 ===
  // Format: P[TYPE][PAYS][NOM<<PRENOM<<<<<<<<<<<<<<<<<<<<<]
  
  extractedData.issuingCountry = line1.substring(2, 5).replace(/</g, "");
  
  const namePart = line1.substring(5);
  const nameParts = namePart.split("<<");
  
  if (nameParts.length >= 1) {
    extractedData.lastName = nameParts[0].replace(/</g, " ").trim();
  }
  if (nameParts.length >= 2) {
    extractedData.firstName = nameParts[1].replace(/</g, " ").trim();
  }

  // === LIGNE 2 ===
  // Format: [NUM(9)][CHECK][NAT(3)][DDN(6)][CHECK][SEX][EXP(6)][CHECK][PERSO(14)][CHECK][CHECK_GLOBAL]
  
  // Numéro de document
  extractedData.documentNumber = line2.substring(0, 9).replace(/</g, "");
  const docNumCheck = parseInt(line2[9], 10);
  const docNumCalculated = calculateMRZChecksum(line2.substring(0, 9));
  
  checksums.documentNumber = {
    expected: docNumCheck,
    actual: docNumCalculated,
    valid: docNumCheck === docNumCalculated,
  };
  
  if (!checksums.documentNumber.valid) {
    errors.push(`Checksum numéro invalide: attendu ${docNumCheck}, calculé ${docNumCalculated}`);
  }

  // Nationalité
  extractedData.nationality = line2.substring(10, 13).replace(/</g, "");

  // Date de naissance
  const dobStr = line2.substring(13, 19);
  const dobCheck = parseInt(line2[19], 10);
  const dobCalculated = calculateMRZChecksum(dobStr);
  
  checksums.birthDate = {
    expected: dobCheck,
    actual: dobCalculated,
    valid: dobCheck === dobCalculated,
  };
  
  if (!checksums.birthDate.valid) {
    errors.push(`Checksum date de naissance invalide`);
  }
  
  extractedData.birthDate = parseMRZDate(dobStr);

  // Sexe
  const sex = line2[20];
  if (sex === "M" || sex === "F") {
    extractedData.sex = sex;
  } else {
    extractedData.sex = "X";
  }

  // Date d'expiration
  const expStr = line2.substring(21, 27);
  const expCheck = parseInt(line2[27], 10);
  const expCalculated = calculateMRZChecksum(expStr);
  
  checksums.expiryDate = {
    expected: expCheck,
    actual: expCalculated,
    valid: expCheck === expCalculated,
  };
  
  if (!checksums.expiryDate.valid) {
    errors.push(`Checksum date d'expiration invalide`);
  }
  
  extractedData.expiryDate = parseMRZDate(expStr);

  // Numéro personnel optionnel
  extractedData.personalNumber = line2.substring(28, 42).replace(/</g, "").trim() || undefined;

  // Checksum global (optionnel pour validation supplémentaire)
  const overallCheckDigit = parseInt(line2[43], 10);
  const overallData = line2.substring(0, 10) + line2.substring(13, 20) + line2.substring(21, 43);
  const overallCalculated = calculateMRZChecksum(overallData);
  
  checksums.overall = {
    expected: overallCheckDigit,
    actual: overallCalculated,
    valid: overallCheckDigit === overallCalculated,
  };

  // Vérifier expiration
  if (extractedData.expiryDate) {
    const expDate = new Date(extractedData.expiryDate);
    if (expDate < new Date()) {
      warnings.push(`Document expiré depuis le ${extractedData.expiryDate}`);
    }
  }

  // Calculer la confiance
  const validChecksums = [
    checksums.documentNumber.valid,
    checksums.birthDate.valid,
    checksums.expiryDate.valid,
    checksums.overall?.valid,
  ].filter(Boolean).length;
  
  const totalChecksums = checksums.overall ? 4 : 3;
  const confidence = errors.length === 0 
    ? (validChecksums / totalChecksums) * 0.9 + 0.1 
    : Math.max(0, (validChecksums / totalChecksums) * 0.5);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    documentType: "PASSPORT",
    extractedData,
    checksums,
    confidence,
  };
}

/**
 * Convertit une date MRZ (AAMMJJ) en format ISO (YYYY-MM-DD)
 */
function parseMRZDate(mrzDate: string): string | undefined {
  if (mrzDate.length !== 6 || mrzDate.includes("<")) {
    return undefined;
  }

  const yy = parseInt(mrzDate.substring(0, 2), 10);
  const mm = mrzDate.substring(2, 4);
  const dd = mrzDate.substring(4, 6);

  // Déterminer le siècle (heuristique : > 30 = 1900s, <= 30 = 2000s)
  const currentYear = new Date().getFullYear() % 100;
  const century = yy > currentYear + 10 ? 1900 : 2000;
  const year = century + yy;

  return `${year}-${mm}-${dd}`;
}

/**
 * Vérifie si une MRZ est potentiellement falsifiée
 * Basé sur des heuristiques et patterns connus
 */
export function detectMRZFraud(mrz: string): { 
  suspiciousFraud: boolean; 
  reasons: string[];
  riskScore: number; // 0-100
} {
  const reasons: string[] = [];
  let riskScore = 0;

  const result = validateMRZ(mrz);

  // Checksums invalides = suspect
  if (!result.checksums.documentNumber.valid) {
    reasons.push("Checksum numéro de document invalide");
    riskScore += 40;
  }
  if (!result.checksums.birthDate.valid) {
    reasons.push("Checksum date de naissance invalide");
    riskScore += 30;
  }
  if (!result.checksums.expiryDate.valid) {
    reasons.push("Checksum date d'expiration invalide");
    riskScore += 30;
  }

  // Vérifier la cohérence des dates
  if (result.extractedData.birthDate && result.extractedData.expiryDate) {
    const birth = new Date(result.extractedData.birthDate);
    const expiry = new Date(result.extractedData.expiryDate);
    const ageDiff = (expiry.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    
    if (ageDiff < 15) {
      reasons.push("Écart entre naissance et expiration trop faible");
      riskScore += 20;
    }
    if (ageDiff > 100) {
      reasons.push("Écart entre naissance et expiration trop élevé");
      riskScore += 20;
    }
  }

  // Vérifier le format du numéro de document français
  if (result.extractedData.issuingCountry === "FRA" && result.extractedData.documentNumber) {
    const docNum = result.extractedData.documentNumber;
    // CNI française: 12 caractères alphanumériques
    if (!/^[A-Z0-9]{12}$/.test(docNum.replace(/</g, ""))) {
      reasons.push("Format numéro CNI française non conforme");
      riskScore += 15;
    }
  }

  // Caractères suspects
  const normalizedMRZ = mrz.toUpperCase();
  if (/[^A-Z0-9<\n\r ]/.test(normalizedMRZ)) {
    reasons.push("Caractères non autorisés dans la MRZ");
    riskScore += 25;
  }

  return {
    suspiciousFraud: riskScore >= 40,
    reasons,
    riskScore: Math.min(100, riskScore),
  };
}

/**
 * Export des fonctions utilitaires pour tests
 */
export const _testUtils = {
  calculateMRZChecksum,
  parseMRZDate,
  MRZ_CHAR_VALUES,
  WEIGHTS,
};

