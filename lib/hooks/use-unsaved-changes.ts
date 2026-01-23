"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

interface UseUnsavedChangesOptions {
  /**
   * Message affiché dans la boîte de dialogue de confirmation
   */
  message?: string;
  /**
   * Indique si le formulaire a des modifications non sauvegardées
   */
  hasUnsavedChanges: boolean;
  /**
   * Callback appelé quand l'utilisateur confirme vouloir quitter
   */
  onConfirmLeave?: () => void;
}

/**
 * Hook pour gérer la confirmation avant de quitter une page avec des modifications non sauvegardées
 *
 * Usage:
 * ```tsx
 * const { setHasChanges, confirmNavigation } = useUnsavedChanges({
 *   hasUnsavedChanges: isDirty,
 *   message: "Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?"
 * });
 * ```
 */
export function useUnsavedChanges({
  message = "Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?",
  hasUnsavedChanges,
  onConfirmLeave,
}: UseUnsavedChangesOptions) {
  const router = useRouter();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Gérer beforeunload pour la fermeture de l'onglet/navigateur
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, message]);

  // Fonction pour naviguer avec confirmation
  const confirmNavigation = useCallback(
    (href: string) => {
      if (hasUnsavedChanges) {
        setPendingNavigation(href);
        setShowConfirmDialog(true);
      } else {
        router.push(href);
      }
    },
    [hasUnsavedChanges, router]
  );

  // Confirmer la navigation
  const handleConfirmLeave = useCallback(() => {
    setShowConfirmDialog(false);
    onConfirmLeave?.();
    if (pendingNavigation) {
      router.push(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [pendingNavigation, router, onConfirmLeave]);

  // Annuler la navigation
  const handleCancelLeave = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingNavigation(null);
  }, []);

  return {
    showConfirmDialog,
    confirmNavigation,
    handleConfirmLeave,
    handleCancelLeave,
    message,
  };
}

/**
 * Hook simplifié pour détecter les changements dans un formulaire
 */
export function useFormDirtyState<T>(initialValues: T, currentValues: T) {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const hasChanges = JSON.stringify(initialValues) !== JSON.stringify(currentValues);
    setIsDirty(hasChanges);
  }, [initialValues, currentValues]);

  return isDirty;
}
