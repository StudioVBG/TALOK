"use client";

import { useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  IntroStep,
  DocumentSelector,
  DocumentScan,
  SelfieCapture,
  ProcessingStep,
  SuccessStep,
  ErrorStep,
} from "./index";
import { useIdentityVerification } from "../hooks/use-identity-verification";
import { ExtractedIdentityData } from "../types";

interface IdentityVerificationFlowProps {
  /**
   * Appelé quand la vérification est réussie
   */
  onSuccess?: (data: ExtractedIdentityData | undefined) => void;
  /**
   * Appelé quand l'utilisateur annule ou veut reporter
   */
  onSkip?: () => void;
  /**
   * Appelé quand l'utilisateur veut de l'aide
   */
  onHelp?: () => void;
  /**
   * Afficher le bouton "Plus tard"
   */
  showSkipButton?: boolean;
  /**
   * Classe CSS additionnelle
   */
  className?: string;
}

/**
 * Composant complet pour le flow de vérification d'identité
 * 
 * Peut être utilisé dans :
 * - L'onboarding locataire
 * - L'onboarding garant
 * - La page profil pour vérifier/re-vérifier
 * - Avant la signature d'un bail
 */
export function IdentityVerificationFlow({
  onSuccess,
  onSkip,
  onHelp,
  showSkipButton = true,
  className,
}: IdentityVerificationFlowProps) {
  const {
    step,
    documentType,
    capturedDocument,
    result,
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
  } = useIdentityVerification();

  // Quand le selfie est capturé, lancer le traitement
  useEffect(() => {
    if (step === "processing" && !result) {
      confirmAndProcess();
    }
  }, [step, result, confirmAndProcess]);

  // Quand la vérification réussit
  useEffect(() => {
    if (step === "success" && result?.success && onSuccess) {
      // L'utilisateur doit cliquer sur "Continuer" pour déclencher onSuccess
    }
  }, [step, result, onSuccess]);

  const handleContinue = useCallback(() => {
    if (onSuccess) {
      onSuccess(result?.extractedData);
    }
  }, [onSuccess, result]);

  const handleSkip = useCallback(() => {
    if (onSkip) {
      onSkip();
    }
  }, [onSkip]);

  const handleCancel = useCallback(() => {
    reset();
  }, [reset]);

  const handleHelp = useCallback(() => {
    if (onHelp) {
      onHelp();
    } else {
      window.open("/help/identity-verification", "_blank");
    }
  }, [onHelp]);

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className={className}>
      {/* DocumentSelector est un Sheet/Dialog - doit être en dehors de AnimatePresence */}
      <DocumentSelector
        open={showDocumentSelector}
        onSelect={selectDocument}
        onClose={closeDocumentSelector}
      />

      <AnimatePresence mode="wait">
        {step === "intro" && (
          <motion.div
            key="intro"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <IntroStep
              onContinue={startVerification}
              onSkip={showSkipButton ? handleSkip : undefined}
            />
          </motion.div>
        )}

        {step === "document_scan_recto" && documentType && (
          <motion.div
            key="scan-recto"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <DocumentScan
              documentType={documentType}
              side="recto"
              onCapture={captureDocumentRecto}
              onBack={goBack}
              onRetry={() => retryCapture("recto")}
              capturedPreview={capturedDocument.rectoPreview}
            />
          </motion.div>
        )}

        {step === "document_scan_verso" && documentType && (
          <motion.div
            key="scan-verso"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <DocumentScan
              documentType={documentType}
              side="verso"
              onCapture={captureDocumentVerso}
              onBack={goBack}
              onRetry={() => retryCapture("verso")}
              capturedPreview={capturedDocument.versoPreview}
            />
          </motion.div>
        )}

        {step === "selfie" && (
          <motion.div
            key="selfie"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <SelfieCapture onCapture={captureSelfie} onBack={goBack} />
          </motion.div>
        )}

        {step === "processing" && (
          <motion.div
            key="processing"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <ProcessingStep />
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <SuccessStep
              extractedData={result?.extractedData}
              onContinue={handleContinue}
            />
          </motion.div>
        )}

        {step === "error" && (
          <motion.div
            key="error"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <ErrorStep
              errorCode={result?.errorCode}
              errorMessage={result?.errorMessage}
              onRetry={reset}
              onCancel={handleCancel}
              onHelp={handleHelp}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

