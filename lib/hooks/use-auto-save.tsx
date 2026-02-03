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

  // Sauvegarder les données
  const saveData = useCallback(
    async (dataToSave: T) => {
      if (!enabled) return;

      setState((prev) => ({ ...prev, isSaving: true }));

      try {
        // Sauvegarder dans localStorage
        const savePayload = {
          data: dataToSave,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(savePayload));

        // Appeler le callback de sauvegarde si fourni
        if (onSave) {
          await onSave(dataToSave);
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
