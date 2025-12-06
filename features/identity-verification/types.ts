/**
 * Types pour la vérification d'identité KYC
 */

export type DocumentType = "cni" | "passport" | "titre_sejour" | "permis";

export type VerificationStep = 
  | "intro"
  | "document_choice"
  | "document_scan_recto"
  | "document_scan_verso"
  | "selfie"
  | "processing"
  | "success"
  | "error";

export interface DocumentTypeOption {
  id: DocumentType;
  label: string;
  description: string;
  icon: string;
  requiresVerso: boolean;
}

export interface CapturedDocument {
  recto?: Blob;
  rectoPreview?: string;
  verso?: Blob;
  versoPreview?: string;
}

export interface CapturedSelfie {
  image: Blob;
  preview: string;
}

export interface ExtractedIdentityData {
  nom?: string;
  prenom?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  sexe?: "M" | "F";
  nationalite?: string;
  numero_document?: string;
  date_expiration?: string;
  date_emission?: string;
}

export interface VerificationResult {
  success: boolean;
  confidence: number;
  extractedData?: ExtractedIdentityData;
  errorCode?: string;
  errorMessage?: string;
}

export interface IdentityVerificationState {
  step: VerificationStep;
  documentType: DocumentType | null;
  capturedDocument: CapturedDocument;
  capturedSelfie: CapturedSelfie | null;
  result: VerificationResult | null;
  isProcessing: boolean;
}

export const DOCUMENT_TYPES: DocumentTypeOption[] = [
  {
    id: "cni",
    label: "Carte d'identité",
    description: "Carte nationale d'identité française",
    icon: "credit-card",
    requiresVerso: true,
  },
  {
    id: "passport",
    label: "Passeport",
    description: "Passeport français ou européen",
    icon: "book-open",
    requiresVerso: false,
  },
  {
    id: "titre_sejour",
    label: "Titre de séjour",
    description: "Carte de séjour en cours de validité",
    icon: "file-text",
    requiresVerso: true,
  },
  {
    id: "permis",
    label: "Permis de conduire",
    description: "Permis de conduire français",
    icon: "car",
    requiresVerso: true,
  },
];

