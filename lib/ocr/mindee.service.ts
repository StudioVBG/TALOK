/**
 * Service OCR avec Mindee
 * Documentation: https://developers.mindee.com/docs
 * 
 * Mindee est spécialisé dans les documents français:
 * - Bulletins de salaire
 * - Pièces d'identité (CNI, Passeport)
 * - Avis d'imposition
 * - RIB
 * - Factures
 * 
 * Tarification: https://mindee.com/pricing
 * - Plan gratuit: 250 pages/mois
 * - Pro: $0.01/page après
 * 
 * Les clés API sont gérées dynamiquement via Admin > Intégrations
 */

import { apiKeysService } from "@/lib/services/api-keys.service";

export interface MindeeConfig {
  apiKey?: string; // Optionnel - utilise la BDD par défaut
  baseUrl?: string;
}

export interface ExtractedField {
  name: string;
  value: string | number | null;
  confidence: number;
  polygon?: Array<{ x: number; y: number }>;
}

export interface PayslipData {
  employerName?: string;
  employerAddress?: string;
  employeeName?: string;
  employeeAddress?: string;
  socialSecurityNumber?: string;
  payPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  grossSalary?: number;
  netSalary?: number;
  netBeforeTax?: number;
  totalCost?: number;
  confidence: number;
}

export interface IdCardData {
  documentType: "cni" | "passport" | "residence_permit" | "other";
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  gender?: string;
  nationality?: string;
  expiryDate?: string;
  documentNumber?: string;
  mrz?: string;
  photoUrl?: string;
  confidence: number;
  isValid: boolean;
}

export interface TaxNoticeData {
  year?: number;
  referenceIncome?: number;
  taxableIncome?: number;
  taxAmount?: number;
  numberOfParts?: number;
  address?: string;
  declarantNames?: string[];
  confidence: number;
}

export interface BankStatementData {
  bankName?: string;
  accountHolder?: string;
  iban?: string;
  bic?: string;
  statementDate?: string;
  openingBalance?: number;
  closingBalance?: number;
  totalCredits?: number;
  totalDebits?: number;
  confidence: number;
}

class MindeeService {
  private baseUrl: string;
  private staticApiKey?: string;

  constructor(config?: Partial<MindeeConfig>) {
    this.baseUrl = config?.baseUrl || "https://api.mindee.net/v1";
    this.staticApiKey = config?.apiKey; // Clé statique optionnelle (pour tests)
  }

  /**
   * Récupérer la clé API (depuis BDD ou variables d'environnement)
   */
  private async getApiKey(): Promise<string> {
    // Utiliser la clé statique si fournie (pour tests)
    if (this.staticApiKey) {
      return this.staticApiKey;
    }

    // Récupérer depuis le service centralisé
    const key = await apiKeysService.getApiKey("mindee");
    
    if (!key) {
      throw new Error(
        "Clé API Mindee non configurée. " +
        "Configurez-la dans Admin > Intégrations ou via MINDEE_API_KEY."
      );
    }
    
    return key;
  }

  private async callAPI(
    endpoint: string,
    file: Buffer | Blob,
    fileName: string
  ): Promise<any> {
    const apiKey = await this.getApiKey();
    const startTime = Date.now();

    const formData = new FormData();
    
    if (file instanceof Buffer) {
      formData.append("document", new Blob([file]), fileName);
    } else {
      formData.append("document", file, fileName);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
      },
      body: formData,
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[Mindee] Erreur API (${responseTime}ms):`, error);
      throw new Error(
        `Mindee API Error: ${error.api_request?.error?.message || response.statusText}`
      );
    }

    console.log(`[Mindee] Appel ${endpoint} réussi (${responseTime}ms)`);
    return response.json();
  }

  /**
   * Analyser un bulletin de salaire français
   * Endpoint: /products/mindee/payslip_fra/v3/predict
   */
  async analyzePayslip(
    file: Buffer | Blob,
    fileName: string = "payslip.pdf"
  ): Promise<PayslipData> {
    try {
      const result = await this.callAPI(
        "/products/mindee/payslip_fra/v3/predict",
        file,
        fileName
      );

      const prediction = result.document?.inference?.prediction;
      if (!prediction) {
        return { confidence: 0 };
      }

      return {
        employerName: prediction.employer?.value,
        employerAddress: prediction.employer_address?.value,
        employeeName: `${prediction.employee?.first_name?.value || ""} ${
          prediction.employee?.last_name?.value || ""
        }`.trim(),
        employeeAddress: prediction.employee_address?.value,
        socialSecurityNumber: prediction.social_security_number?.value,
        payPeriod: {
          startDate: prediction.pay_period?.start_date?.value,
          endDate: prediction.pay_period?.end_date?.value,
        },
        grossSalary: prediction.gross_salary?.value,
        netSalary: prediction.net_paid?.value,
        netBeforeTax: prediction.net_before_tax?.value,
        totalCost: prediction.total_cost_employer?.value,
        confidence: this.calculateConfidence(prediction),
      };
    } catch (error) {
      console.error("Erreur analyse bulletin de salaire:", error);
      throw error;
    }
  }

  /**
   * Analyser une pièce d'identité française
   * Endpoint: /products/mindee/idcard_fr/v2/predict
   */
  async analyzeIdCard(
    file: Buffer | Blob,
    fileName: string = "id.jpg"
  ): Promise<IdCardData> {
    try {
      const result = await this.callAPI(
        "/products/mindee/idcard_fr/v2/predict",
        file,
        fileName
      );

      const prediction = result.document?.inference?.prediction;
      if (!prediction) {
        return {
          documentType: "other",
          confidence: 0,
          isValid: false,
        };
      }

      const expiryDate = prediction.expiry_date?.value;
      const isExpired = expiryDate
        ? new Date(expiryDate) < new Date()
        : false;

      return {
        documentType: this.detectIdType(prediction),
        firstName: prediction.given_names?.join(" "),
        lastName: prediction.surname?.value,
        birthDate: prediction.birth_date?.value,
        birthPlace: prediction.birth_place?.value,
        gender: prediction.gender?.value,
        nationality: prediction.nationality?.value,
        expiryDate: prediction.expiry_date?.value,
        documentNumber: prediction.id_number?.value,
        mrz: prediction.mrz1?.value
          ? `${prediction.mrz1?.value}\n${prediction.mrz2?.value || ""}`
          : undefined,
        confidence: this.calculateConfidence(prediction),
        isValid: !isExpired && prediction.id_number?.value !== undefined,
      };
    } catch (error) {
      console.error("Erreur analyse pièce d'identité:", error);
      throw error;
    }
  }

  /**
   * Analyser un avis d'imposition français
   * Endpoint: /products/mindee/french_tax_return/v1/predict
   */
  async analyzeTaxNotice(
    file: Buffer | Blob,
    fileName: string = "tax.pdf"
  ): Promise<TaxNoticeData> {
    try {
      const result = await this.callAPI(
        "/products/mindee/french_tax_return/v1/predict",
        file,
        fileName
      );

      const prediction = result.document?.inference?.prediction;
      if (!prediction) {
        return { confidence: 0 };
      }

      return {
        year: prediction.year?.value,
        referenceIncome: prediction.reference_fiscal_income?.value,
        taxableIncome: prediction.taxable_income?.value,
        taxAmount: prediction.tax_amount?.value,
        numberOfParts: prediction.number_of_tax_shares?.value,
        address: prediction.address?.value,
        declarantNames: prediction.declarants?.map(
          (d: any) => `${d.first_name?.value} ${d.last_name?.value}`
        ),
        confidence: this.calculateConfidence(prediction),
      };
    } catch (error) {
      console.error("Erreur analyse avis d'imposition:", error);
      throw error;
    }
  }

  /**
   * Analyser un relevé bancaire
   * Endpoint: /products/mindee/bank_statement_fr/v1/predict
   */
  async analyzeBankStatement(
    file: Buffer | Blob,
    fileName: string = "bank.pdf"
  ): Promise<BankStatementData> {
    try {
      const result = await this.callAPI(
        "/products/mindee/bank_statement_fr/v1/predict",
        file,
        fileName
      );

      const prediction = result.document?.inference?.prediction;
      if (!prediction) {
        return { confidence: 0 };
      }

      return {
        bankName: prediction.bank_name?.value,
        accountHolder: prediction.client_name?.value,
        iban: prediction.iban?.value,
        bic: prediction.bic?.value,
        statementDate: prediction.date?.value,
        openingBalance: prediction.opening_balance?.value,
        closingBalance: prediction.closing_balance?.value,
        totalCredits: prediction.total_credits?.value,
        totalDebits: prediction.total_debits?.value,
        confidence: this.calculateConfidence(prediction),
      };
    } catch (error) {
      console.error("Erreur analyse relevé bancaire:", error);
      throw error;
    }
  }

  /**
   * Analyser un document générique et détecter son type
   */
  async analyzeDocument(
    file: Buffer | Blob,
    fileName: string,
    hint?: "payslip" | "id" | "tax" | "bank"
  ): Promise<{
    type: string;
    data: PayslipData | IdCardData | TaxNoticeData | BankStatementData;
  }> {
    // Si on a un indice, utiliser directement le bon endpoint
    if (hint) {
      switch (hint) {
        case "payslip":
          return { type: "payslip", data: await this.analyzePayslip(file, fileName) };
        case "id":
          return { type: "id", data: await this.analyzeIdCard(file, fileName) };
        case "tax":
          return { type: "tax", data: await this.analyzeTaxNotice(file, fileName) };
        case "bank":
          return { type: "bank", data: await this.analyzeBankStatement(file, fileName) };
      }
    }

    // Sinon, essayer de détecter automatiquement
    // On essaie d'abord le bulletin de salaire (le plus commun)
    try {
      const payslipData = await this.analyzePayslip(file, fileName);
      if (payslipData.confidence > 0.7) {
        return { type: "payslip", data: payslipData };
      }
    } catch {}

    // Puis la pièce d'identité
    try {
      const idData = await this.analyzeIdCard(file, fileName);
      if (idData.confidence > 0.7) {
        return { type: "id", data: idData };
      }
    } catch {}

    // Sinon, retourner une erreur
    throw new Error("Type de document non reconnu");
  }

  // ============================================
  // HELPERS
  // ============================================

  private calculateConfidence(prediction: any): number {
    // Calculer la moyenne des confidences de tous les champs
    let totalConfidence = 0;
    let fieldCount = 0;

    for (const key in prediction) {
      const field = prediction[key];
      if (field?.confidence !== undefined) {
        totalConfidence += field.confidence;
        fieldCount++;
      }
    }

    return fieldCount > 0 ? totalConfidence / fieldCount : 0;
  }

  private detectIdType(prediction: any): IdCardData["documentType"] {
    const documentType = prediction.document_type?.value?.toLowerCase();
    
    if (documentType?.includes("cni") || documentType?.includes("carte")) {
      return "cni";
    }
    if (documentType?.includes("passport")) {
      return "passport";
    }
    if (documentType?.includes("sejour") || documentType?.includes("residence")) {
      return "residence_permit";
    }
    return "other";
  }
}

// Export singleton
export const mindeeService = new MindeeService();

// Export classe pour tests ou configuration custom
export { MindeeService };

