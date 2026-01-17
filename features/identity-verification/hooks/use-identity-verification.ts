"use client";

import { useState, useCallback } from "react";
import {
  DocumentType,
  VerificationStep,
  CapturedDocument,
  CapturedSelfie,
  VerificationResult,
  DOCUMENT_TYPES,
} from "../types";
import { identityVerificationService } from "../services/identity-verification.service";

export interface UseIdentityVerificationReturn {
  // State
  step: VerificationStep;
  documentType: DocumentType | null;
  capturedDocument: CapturedDocument;
  capturedSelfie: CapturedSelfie | null;
  result: VerificationResult | null;
  isProcessing: boolean;
  showDocumentSelector: boolean;

  // Actions
  startVerification: () => void;
  selectDocument: (type: DocumentType) => void;
  captureDocumentRecto: (blob: Blob, preview: string) => void;
  captureDocumentVerso: (blob: Blob, preview: string) => void;
  captureSelfie: (blob: Blob, preview: string) => void;
  retryCapture: (side: "recto" | "verso" | "selfie") => void;
  confirmAndProcess: () => Promise<void>;
  reset: () => void;
  goBack: () => void;
  closeDocumentSelector: () => void;
}

export function useIdentityVerification(): UseIdentityVerificationReturn {
  const [step, setStep] = useState<VerificationStep>("intro");
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [capturedDocument, setCapturedDocument] = useState<CapturedDocument>({});
  const [capturedSelfie, setCapturedSelfie] = useState<CapturedSelfie | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);

  const startVerification = useCallback(() => {
    setShowDocumentSelector(true);
  }, []);

  const selectDocument = useCallback((type: DocumentType) => {
    setDocumentType(type);
    setShowDocumentSelector(false);
    setStep("document_scan_recto");
  }, []);

  const captureDocumentRecto = useCallback(
    (blob: Blob, preview: string) => {
      setCapturedDocument((prev) => ({
        ...prev,
        recto: blob,
        rectoPreview: preview,
      }));

      // Vérifier si le document nécessite un verso
      const docConfig = DOCUMENT_TYPES.find((d) => d.id === documentType);
      if (docConfig?.requiresVerso) {
        setStep("document_scan_verso");
      } else {
        setStep("selfie");
      }
    },
    [documentType]
  );

  const captureDocumentVerso = useCallback((blob: Blob, preview: string) => {
    setCapturedDocument((prev) => ({
      ...prev,
      verso: blob,
      versoPreview: preview,
    }));
    setStep("selfie");
  }, []);

  const captureSelfie = useCallback((blob: Blob, preview: string) => {
    setCapturedSelfie({ image: blob, preview });
    // Lancer automatiquement le traitement
    setStep("processing");
  }, []);

  const retryCapture = useCallback((side: "recto" | "verso" | "selfie") => {
    if (side === "recto") {
      setCapturedDocument((prev) => ({
        ...prev,
        recto: undefined,
        rectoPreview: undefined,
      }));
      setStep("document_scan_recto");
    } else if (side === "verso") {
      setCapturedDocument((prev) => ({
        ...prev,
        verso: undefined,
        versoPreview: undefined,
      }));
      setStep("document_scan_verso");
    } else {
      setCapturedSelfie(null);
      setStep("selfie");
    }
  }, []);

  const confirmAndProcess = useCallback(async () => {
    if (!documentType || !capturedDocument.recto) {
      setResult({
        success: false,
        confidence: 0,
        errorCode: "missing_document",
        errorMessage: "Document manquant",
      });
      setStep("error");
      return;
    }

    setIsProcessing(true);
    setStep("processing");

    try {
      // 1. Upload du document
      const { rectoPath, versoPath } = await identityVerificationService.uploadDocument(
        documentType,
        capturedDocument.recto,
        capturedDocument.verso
      );

      // 2. Upload du selfie
      let selfiePath: string | undefined;
      if (capturedSelfie) {
        selfiePath = await identityVerificationService.uploadSelfie(capturedSelfie.image);
      }

      // 3. Vérifier l'identité
      const verificationResult = await identityVerificationService.verifyIdentity(
        documentType,
        rectoPath,
        versoPath,
        selfiePath
      );

      setResult(verificationResult);
      setStep(verificationResult.success ? "success" : "error");
    } catch (error: unknown) {
      setResult({
        success: false,
        confidence: 0,
        errorCode: "upload_error",
        errorMessage: error instanceof Error ? error.message : "Erreur lors de l'upload",
      });
      setStep("error");
    } finally {
      setIsProcessing(false);
    }
  }, [documentType, capturedDocument, capturedSelfie]);

  const reset = useCallback(() => {
    setStep("intro");
    setDocumentType(null);
    setCapturedDocument({});
    setCapturedSelfie(null);
    setResult(null);
    setIsProcessing(false);
    setShowDocumentSelector(false);
  }, []);

  const goBack = useCallback(() => {
    switch (step) {
      case "document_scan_recto":
        setDocumentType(null);
        setShowDocumentSelector(true);
        break;
      case "document_scan_verso":
        setStep("document_scan_recto");
        break;
      case "selfie":
        const docConfig = DOCUMENT_TYPES.find((d) => d.id === documentType);
        if (docConfig?.requiresVerso) {
          setStep("document_scan_verso");
        } else {
          setStep("document_scan_recto");
        }
        break;
      case "error":
        setStep("intro");
        break;
      default:
        setStep("intro");
    }
  }, [step, documentType]);

  const closeDocumentSelector = useCallback(() => {
    setShowDocumentSelector(false);
  }, []);

  return {
    step,
    documentType,
    capturedDocument,
    capturedSelfie,
    result,
    isProcessing,
    showDocumentSelector,
    startVerification,
    selectDocument,
    captureDocumentRecto,
    captureDocumentVerso,
    captureSelfie,
    retryCapture,
    confirmAndProcess,
    reset,
    goBack,
    closeDocumentSelector,
  };
}

