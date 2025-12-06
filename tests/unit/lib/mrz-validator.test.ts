/**
 * Tests unitaires pour le validateur MRZ
 * Conforme aux spécifications ICAO 9303 pour les CNI françaises et passeports
 * 
 * Formats supportés:
 * - CNI française (ID-2): 2 lignes de 36 caractères
 * - Passeport (TD3): 2 lignes de 44 caractères
 */

import { describe, it, expect } from "vitest";
import { validateMRZ, calculateMRZChecksum, detectMRZFraud } from "@/lib/ocr/mrz-validator";

describe("calculateMRZChecksum", () => {
  it("devrait calculer correctement pour des chiffres", () => {
    // 7*7 + 3*3 + 1*1 = 49 + 9 + 1 = 59, 59 % 10 = 9
    expect(calculateMRZChecksum("731")).toBe(9);
  });

  it("devrait calculer correctement pour des lettres", () => {
    // A=10, B=11, C=12
    // 10*7 + 11*3 + 12*1 = 70 + 33 + 12 = 115, 115 % 10 = 5
    expect(calculateMRZChecksum("ABC")).toBe(5);
  });

  it("devrait traiter < comme 0", () => {
    // 0*7 + 0*3 + 0*1 = 0
    expect(calculateMRZChecksum("<<<")).toBe(0);
  });

  it("devrait calculer pour une séquence mixte", () => {
    // Exemple réel de date de naissance 900101 (1er janvier 1990)
    // 9*7 + 0*3 + 0*1 + 1*7 + 0*3 + 1*1 = 63 + 0 + 0 + 7 + 0 + 1 = 71
    // 71 % 10 = 1
    expect(calculateMRZChecksum("900101")).toBe(1);
  });
});

describe("validateMRZ", () => {
  describe("Structure de base", () => {
    it("devrait rejeter une MRZ avec une seule ligne", () => {
      const result = validateMRZ("IDFRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<");
      expect(result.valid).toBe(false);
      expect(result.documentType).toBe("UNKNOWN");
    });

    it("devrait rejeter une MRZ avec longueur non standard", () => {
      const mrz = `IDFRADUPONT<<JEAN
1234567890`;
      const result = validateMRZ(mrz);
      expect(result.valid).toBe(false);
      expect(result.documentType).toBe("UNKNOWN");
    });
  });

  describe("Validation CNI française (36 caractères)", () => {
    // CNI française: exactement 36 caractères par ligne
    const validCNI_Line1 = "IDFRADUPONT<<JEAN<MARIE<<<<<<<<<<<";  // 35 chars
    const validCNI_Line2 = "123456789012XFRA9001011M2512318<<<<";  // 35 chars
    
    it("devrait détecter le type ID pour une CNI de 36 caractères", () => {
      // Créer une MRZ de 36 caractères exactement
      const line1 = "IDFRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<";  // 36 chars
      const line2 = "123456789012XFRA9001011M2512318<<<<<";  // 36 chars
      const mrz = `${line1}\n${line2}`;
      
      const result = validateMRZ(mrz);
      expect(result.documentType).toBe("ID");
    });

    it("devrait extraire le pays émetteur FRA", () => {
      const line1 = "IDFRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<";  // 36 chars
      const line2 = "123456789012XFRA9001011M2512318<<<<<";  // 36 chars
      const mrz = `${line1}\n${line2}`;
      
      const result = validateMRZ(mrz);
      expect(result.extractedData.issuingCountry).toBe("FRA");
    });

    it("devrait extraire le nom et prénom", () => {
      const line1 = "IDFRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<";
      const line2 = "123456789012XFRA9001011M2512318<<<<<";
      const mrz = `${line1}\n${line2}`;
      
      const result = validateMRZ(mrz);
      expect(result.extractedData.lastName).toBe("DUPONT");
      expect(result.extractedData.firstName?.includes("JEAN")).toBe(true);
    });
  });

  describe("Validation Passeport (44 caractères)", () => {
    it("devrait détecter le type PASSPORT pour 44 caractères", () => {
      // Passeport: exactement 44 caractères par ligne
      const line1 = "P<FRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<<<<<<<<<";  // 44 chars
      const line2 = "12AB456789XFRA9001011M2512317<<<<<<<<<<<<<02";  // 44 chars
      const mrz = `${line1}\n${line2}`;
      
      const result = validateMRZ(mrz);
      expect(result.documentType).toBe("PASSPORT");
    });

    it("devrait extraire les données du passeport", () => {
      const line1 = "P<FRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<<<<<<<<<";
      const line2 = "12AB456789XFRA9001011M2512317<<<<<<<<<<<<<02";
      const mrz = `${line1}\n${line2}`;
      
      const result = validateMRZ(mrz);
      expect(result.extractedData.lastName).toBe("DUPONT");
      expect(result.extractedData.issuingCountry).toBe("FRA");
    });
  });

  describe("Cas limites", () => {
    it("devrait gérer une MRZ vide", () => {
      const result = validateMRZ("");
      expect(result.valid).toBe(false);
      expect(result.documentType).toBe("UNKNOWN");
    });

    it("devrait gérer une MRZ avec uniquement des espaces", () => {
      const result = validateMRZ("   \n   ");
      expect(result.valid).toBe(false);
    });

    it("devrait normaliser les caractères en majuscules", () => {
      const line1 = "idfradupont<<jean<marie<<<<<<<<<<<<<";  // 36 chars
      const line2 = "123456789012xfra9001011m2512318<<<<<";  // 36 chars
      const mrz = `${line1}\n${line2}`;
      
      const result = validateMRZ(mrz);
      // Après normalisation, devrait être reconnu comme ID
      expect(result.documentType).toBe("ID");
      expect(result.extractedData.lastName).toBe("DUPONT");
    });
  });

  describe("Checksums", () => {
    it("devrait fournir les détails de checksums", () => {
      const line1 = "IDFRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<";
      const line2 = "123456789012XFRA9001011M2512318<<<<<";
      const mrz = `${line1}\n${line2}`;
      
      const result = validateMRZ(mrz);
      expect(result.checksums).toBeDefined();
      expect(result.checksums.documentNumber).toBeDefined();
      expect(result.checksums.birthDate).toBeDefined();
      expect(result.checksums.expiryDate).toBeDefined();
    });
  });
});

describe("detectMRZFraud", () => {
  it("devrait détecter une MRZ avec format inconnu", () => {
    const mrz = "INVALID_MRZ_FORMAT";
    
    const result = detectMRZFraud(mrz);
    // MRZ invalide = risque élevé
    expect(result.riskScore).toBeGreaterThan(0);
  });

  it("devrait détecter des caractères non autorisés", () => {
    // Le # n'est pas autorisé dans une MRZ
    const mrz = `IDFRADUPONT#<JEAN<MARIE<<<<<<<<<<<<
123456789012XFRA9001011M2512318<<<<<`;
    
    const result = detectMRZFraud(mrz);
    expect(result.reasons.some(r => r.includes("non autorisé"))).toBe(true);
  });

  it("devrait retourner un objet avec les propriétés attendues", () => {
    const line1 = "IDFRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<";
    const line2 = "123456789012XFRA9001011M2512318<<<<<";
    const mrz = `${line1}\n${line2}`;
    
    const result = detectMRZFraud(mrz);
    expect(result).toHaveProperty("suspiciousFraud");
    expect(result).toHaveProperty("reasons");
    expect(result).toHaveProperty("riskScore");
    expect(typeof result.suspiciousFraud).toBe("boolean");
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(typeof result.riskScore).toBe("number");
  });
});

describe("Intégration - Validation complète", () => {
  it("devrait retourner des résultats cohérents pour des entrées identiques", () => {
    const line1 = "IDFRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<";
    const line2 = "123456789012XFRA9001011M2512318<<<<<";
    const mrz = `${line1}\n${line2}`;
    
    const result1 = validateMRZ(mrz);
    const result2 = validateMRZ(mrz);
    
    expect(result1.valid).toBe(result2.valid);
    expect(result1.errors.length).toBe(result2.errors.length);
    expect(result1.extractedData.lastName).toBe(result2.extractedData.lastName);
    expect(result1.confidence).toBe(result2.confidence);
  });

  it("devrait fournir un niveau de confiance entre 0 et 1", () => {
    const line1 = "IDFRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<";
    const line2 = "123456789012XFRA9001011M2512318<<<<<";
    const mrz = `${line1}\n${line2}`;
    
    const result = validateMRZ(mrz);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("devrait identifier correctement le type de document", () => {
    // CNI
    const cniLine1 = "IDFRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<";
    const cniLine2 = "123456789012XFRA9001011M2512318<<<<<";
    const cniMRZ = `${cniLine1}\n${cniLine2}`;
    
    const cniResult = validateMRZ(cniMRZ);
    expect(cniResult.documentType).toBe("ID");
    
    // Passeport
    const passLine1 = "P<FRADUPONT<<JEAN<MARIE<<<<<<<<<<<<<<<<<<<<<";
    const passLine2 = "12AB456789XFRA9001011M2512317<<<<<<<<<<<<<02";
    const passMRZ = `${passLine1}\n${passLine2}`;
    
    const passResult = validateMRZ(passMRZ);
    expect(passResult.documentType).toBe("PASSPORT");
  });
});
