"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

// -- Types -------------------------------------------------------------------

export type AnalysisStep = 1 | 2 | 3 | 4;

export type AnalysisStatus =
  | "uploading"
  | "analyzing"
  | "detecting"
  | "extracting"
  | "completed"
  | "failed";

export interface FieldConfidence {
  value: string | number | null;
  confidence: number;
}

export interface AnalysisResult {
  id: string;
  status: AnalysisStatus;
  confidence_score: number;
  extracted_data: {
    document_type?: FieldConfidence;
    supplier_name?: FieldConfidence;
    supplier_siret?: FieldConfidence & { verified?: boolean };
    amount_ttc_cents?: FieldConfidence;
    vat_amount_cents?: FieldConfidence & { coherent?: boolean };
    document_date?: FieldConfidence;
    category?: FieldConfidence;
    accounting_account?: FieldConfidence;
    property_id?: FieldConfidence;
    alerts?: Array<{ level: "error" | "warning"; message: string }>;
  };
  proposed_entry?: {
    lines: Array<{
      account: string;
      label: string;
      debitCents: number;
      creditCents: number;
    }>;
  };
}

interface UploadResponse {
  success: boolean;
  data: { id: string; url: string };
}

interface AnalyzeResponse {
  success: boolean;
  data: { analysis_id: string };
}

interface AnalysisStatusResponse {
  success: boolean;
  data: AnalysisResult;
}

// -- Hook --------------------------------------------------------------------

export function useDocumentAnalysis() {
  const { profile } = useAuth();
  const [step, setStep] = useState<AnalysisStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Generate preview URL when file changes
  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const poll = useCallback(
    (docId: string) => {
      stopPolling();

      pollRef.current = setInterval(async () => {
        try {
          const res = await apiClient.get<AnalysisStatusResponse>(
            `/accounting/documents/${docId}/analysis`
          );
          const data = res.data;

          if (data.status === "completed") {
            stopPolling();
            setAnalysis(data);
            setIsAnalyzing(false);
            setStep(3);
          } else if (data.status === "failed") {
            stopPolling();
            setIsAnalyzing(false);
            setError("L'analyse a echoue. Veuillez reessayer.");
          }
        } catch (error) {
          // Inside a setInterval callback — do NOT re-throw, it would
          // crash the polling. Log and surface a user-facing message.
          console.error(
            "[useDocumentAnalysis] status poll failed:",
            error,
          );
          stopPolling();
          setIsAnalyzing(false);
          setError("Erreur lors de la verification du statut.");
        }
      }, 2000);
    },
    [stopPolling]
  );

  const upload = useCallback(
    async (selectedFile: File) => {
      if (!profile) return;

      setError(null);
      setIsUploading(true);
      setFile(selectedFile);
      setStep(2);

      try {
        // Upload file as FormData
        const formData = new FormData();
        formData.append("file", selectedFile);
        const defaultEntityId =
          (profile as { default_entity_id?: string | null } | null)
            ?.default_entity_id ?? "";
        formData.append("entityId", defaultEntityId);

        const uploadRes = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error("Erreur lors de l'envoi du fichier");
        }

        const uploadData: UploadResponse = await uploadRes.json();
        const docId = uploadData.data.id;
        setDocumentId(docId);
        setIsUploading(false);

        // Start analysis
        setIsAnalyzing(true);
        const analyzeRes = await apiClient.post<AnalyzeResponse>(
          "/accounting/documents/analyze",
          { documentId: docId }
        );
        setAnalysisId(analyzeRes.data.analysis_id);

        // Start polling
        poll(docId);
      } catch (err) {
        setIsUploading(false);
        setIsAnalyzing(false);
        setError(
          err instanceof Error ? err.message : "Erreur lors de l'envoi"
        );
      }
    },
    [profile, poll]
  );

  const validate = useCallback(
    async (overrides?: Record<string, unknown>) => {
      if (!documentId) return;

      try {
        await apiClient.post(
          `/accounting/documents/${documentId}/validate`,
          {
            ...overrides,
            autoValidate: true,
          }
        );
        setStep(4);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erreur lors de la validation"
        );
      }
    },
    [documentId]
  );

  const reset = useCallback(() => {
    stopPolling();
    setStep(1);
    setFile(null);
    setFilePreviewUrl(null);
    setDocumentId(null);
    setAnalysisId(null);
    setAnalysis(null);
    setIsUploading(false);
    setIsAnalyzing(false);
    setError(null);
  }, [stopPolling]);

  const retryAnalysis = useCallback(() => {
    if (file) {
      setError(null);
      upload(file);
    }
  }, [file, upload]);

  return {
    step,
    setStep,
    file,
    filePreviewUrl,
    documentId,
    analysisId,
    analysis,
    upload,
    validate,
    reset,
    retryAnalysis,
    isUploading,
    isAnalyzing,
    error,
    setError,
  };
}
