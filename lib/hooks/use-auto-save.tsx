"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface UseAutoSaveOptions<T> {
  /**
   * Données à sauvegarder
   */
  data: T;
  /**
   * Clé unique pour le stockage local
   */
  storageKey: string;
  /**
   * Délai avant sauvegarde automatique (ms)
   * @default 2000
   */
  debounceMs?: number;
  /**
   * Callback appelé lors de la sauvegarde
   */
  onSave?: (data: T) => Promise<void> | void;
  /**
   * Activer/désactiver l'auto-save
   * @default true
   */
  enabled?: boolean;
  /**
   * Afficher un toast lors de la sauvegarde
   * @default false
   */
  showToast?: boolean;
}

interface AutoSaveState {
  lastSaved: Date | null;
  isSaving: boolean;
  hasRestoredData: boolean;
}

/**
 * Hook pour sauvegarder automatiquement les données d'un formulaire
 *
 * Features:
 * - Sauvegarde debounced dans localStorage
 * - Restauration des données au chargement
 * - Callback optionnel pour sauvegarde serveur
 * - Toast de confirmation optionnel
 *
 * Usage:
 * ```tsx
 * const { restoredData, clearSavedData, lastSaved } = useAutoSave({
 *   data: formValues,
 *   storageKey: `property-wizard-${propertyId}`,
 *   debounceMs: 3000,
 *   onSave: async (data) => {
 *     await saveDraft(data);
 *   }
 * });
 * ```
 */
export function useAutoSave<T>({
  data,
  storageKey,
  debounceMs = 2000,
  onSave,
  enabled = true,
  showToast = false,
}: UseAutoSaveOptions<T>) {
  const { toast } = useToast();
  const [state, setState] = useState<AutoSaveState>({
    lastSaved: null,
    isSaving: false,
    hasRestoredData: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialDataRef = useRef<T | null>(null);
  const isFirstRender = useRef(true);

  // Restaurer les données sauvegardées au montage
  const restoredData = useCallback((): T | null => {
    if (typeof window === "undefined") return null;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.data as T;
      }
    } catch (error) {
      console.error("Erreur lors de la restauration des données:", error);
    }
    return null;
  }, [storageKey]);

  // Sauvegarder les données with retry for onSave failures
  const saveData = useCallback(
    async (dataToSave: T, retryCount = 0) => {
      if (!enabled) return;

      setState((prev) => ({ ...prev, isSaving: true }));

      try {
        // Sauvegarder dans localStorage (always succeeds)
        const savePayload = {
          data: dataToSave,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(savePayload));

        // Appeler le callback de sauvegarde si fourni, with retry
        if (onSave) {
          try {
            await onSave(dataToSave);
          } catch (saveError) {
            // Retry up to 2 times with exponential backoff
            if (retryCount < 2) {
              const delay = 1000 * Math.pow(2, retryCount);
              console.warn(`[AutoSave] onSave failed, retrying in ${delay}ms (attempt ${retryCount + 1}/2)`);
              setTimeout(() => saveData(dataToSave, retryCount + 1), delay);
              return;
            }
            // After max retries, data is still in localStorage
            console.error("[AutoSave] onSave failed after retries, data preserved in localStorage:", saveError);
          }
        }

        const now = new Date();
        setState((prev) => ({
          ...prev,
          lastSaved: now,
          isSaving: false,
        }));

        if (showToast) {
          toast({
            title: "Brouillon sauvegardé",
            description: `Dernière sauvegarde : ${now.toLocaleTimeString("fr-FR")}`,
            duration: 2000,
          });
        }
      } catch (error) {
        console.error("Erreur lors de la sauvegarde:", error);
        setState((prev) => ({ ...prev, isSaving: false }));
      }
    },
    [enabled, storageKey, onSave, showToast, toast]
  );

  // Debounced save effect
  useEffect(() => {
    if (!enabled || isFirstRender.current) {
      isFirstRender.current = false;
      initialDataRef.current = data;
      return;
    }

    // Ne pas sauvegarder si les données n'ont pas changé
    if (JSON.stringify(data) === JSON.stringify(initialDataRef.current)) {
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      saveData(data);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, debounceMs, saveData]);

  // Effacer les données sauvegardées
  const clearSavedData = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(storageKey);
      setState((prev) => ({ ...prev, lastSaved: null }));
    } catch (error) {
      console.error("Erreur lors de la suppression des données:", error);
    }
  }, [storageKey]);

  // Forcer une sauvegarde immédiate
  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    return saveData(data);
  }, [data, saveData]);

  // Vérifier si des données sauvegardées existent
  const hasSavedData = useCallback(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) !== null;
  }, [storageKey]);

  return {
    restoredData,
    clearSavedData,
    saveNow,
    hasSavedData,
    lastSaved: state.lastSaved,
    isSaving: state.isSaving,
  };
}

/**
 * Bannière de restauration d'un brouillon sauvegardé
 */
export function DraftBanner({
  hasDraft,
  lastSavedAt,
  onRestore,
  onDismiss,
}: {
  hasDraft: boolean;
  lastSavedAt?: Date | string | null;
  onRestore: () => void;
  onDismiss: () => void;
}) {
  if (!hasDraft) return null;

  const formattedDate = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
      <p className="text-sm text-blue-800 dark:text-blue-200">
        Un brouillon a été sauvegardé{formattedDate ? ` le ${formattedDate}` : ""}.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          Restaurer
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
        >
          Ignorer
        </button>
      </div>
    </div>
  );
}

/**
 * Composant d'indicateur de sauvegarde automatique
 */
export function AutoSaveIndicator({
  lastSaved,
  isSaving,
}: {
  lastSaved: Date | null;
  isSaving: boolean;
}) {
  if (isSaving) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        Sauvegarde en cours...
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Sauvegardé à {lastSaved.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </div>
    );
  }

  return null;
}
