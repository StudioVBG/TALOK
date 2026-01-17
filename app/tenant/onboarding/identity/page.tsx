"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import {
  IntroStep,
  DocumentSelector,
  DocumentScan,
  SelfieCapture,
  ProcessingStep,
  SuccessStep,
  ErrorStep,
  useIdentityVerification,
} from "@/features/identity-verification";

export default function TenantIdentityPage() {
  const router = useRouter();
  const { toast } = useToast();

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

  const handleContinue = useCallback(async () => {
    try {
      // Marquer l'étape comme complétée
      await onboardingService.markStepCompleted("tenant_identity", "tenant");

      toast({
        title: "Identité vérifiée !",
        description: "Votre identité a été vérifiée avec succès.",
      });

      // Rediriger vers l'étape suivante (paiements)
      router.push("/tenant/onboarding/payments");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  }, [router, toast]);

  const handleSkip = useCallback(() => {
    toast({
      title: "Vérification reportée",
      description: "Vous pourrez vérifier votre identité plus tard depuis votre profil.",
    });
    router.push("/tenant/onboarding/payments");
  }, [router, toast]);

  const handleCancel = useCallback(() => {
    reset();
  }, [reset]);

  const handleHelp = useCallback(() => {
    // Ouvrir le centre d'aide ou un chat support
    window.open("/help/identity-verification", "_blank");
  }, []);

  // Animation de transition entre les étapes
  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="min-h-screen">
      {/* Sélecteur de document (Sheet/Dialog - en dehors de AnimatePresence) */}
      <DocumentSelector
        open={showDocumentSelector}
        onSelect={selectDocument}
        onClose={closeDocumentSelector}
      />

      <AnimatePresence mode="wait">
        {/* Étape 1 : Introduction */}
        {step === "intro" && (
          <motion.div
            key="intro"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <IntroStep onContinue={startVerification} onSkip={handleSkip} />
          </motion.div>
        )}

        {/* Étape 2 : Scan document recto */}
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

        {/* Étape 3 : Scan document verso */}
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

        {/* Étape 4 : Selfie */}
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

        {/* Étape 5 : Processing */}
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

        {/* Étape 6 : Succès */}
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

        {/* Étape 7 : Erreur */}
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

