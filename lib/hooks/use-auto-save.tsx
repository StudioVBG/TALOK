/**
 * Hook pour la sauvegarde automatique des formulaires
 *
 * Sauvegarde l'état du formulaire dans localStorage pour éviter
 * la perte de données en cas de:
 * - Fermeture accidentelle de l'onglet
 * - Perte de connexion
 * - Crash du navigateur
 * - Navigation accidentelle
 *
 * @module lib/hooks/use-auto-save
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface AutoSaveOptions<T> {
  /** Clé unique pour identifier le brouillon dans localStorage */
  storageKey: string;
  /** Délai en ms avant la sauvegarde automatique (défaut: 1000ms) */
  debounceMs?: number;
  /** Callback appelé à chaque sauvegarde */
  onSave?: (data: T) => void;
  /** Callback appelé lors de la restauration d'un brouillon */
  onRestore?: (data: T) => void;
  /** Durée de vie du brouillon en ms (défaut: 24h) */
  ttlMs?: number;
  /** Activer/désactiver les notifications toast */
  showToasts?: boolean;
}

interface SavedDraft<T> {
  data: T;
  savedAt: number;
  version: number;
}

const STORAGE_PREFIX = "talok_draft_";
const DEFAULT_DEBOUNCE_MS = 1000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures
const CURRENT_VERSION = 1;

/**
 * Hook pour la sauvegarde automatique des formulaires
 */
export function useAutoSave<T extends Record<string, any>>(
  data: T,
  options: AutoSaveOptions<T>
) {
  const {
    storageKey,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    onSave,
    onRestore,
    ttlMs = DEFAULT_TTL_MS,
    showToasts = true,
  } = options;

  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fullStorageKey = `${STORAGE_PREFIX}${storageKey}`;

  /**
   * Vérifie si un brouillon existe et est valide
   */
  const checkForDraft = useCallback((): SavedDraft<T> | null => {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(fullStorageKey);
      if (!stored) return null;

      const draft: SavedDraft<T> = JSON.parse(stored);

      // Vérifier la version
      if (draft.version !== CURRENT_VERSION) {
        localStorage.removeItem(fullStorageKey);
        return null;
      }

      // Vérifier l'expiration
      if (Date.now() - draft.savedAt > ttlMs) {
        localStorage.removeItem(fullStorageKey);
        return null;
      }

      return draft;
    } catch {
      return null;
    }
  }, [fullStorageKey, ttlMs]);

  /**
   * Sauvegarde les données
   */
  const save = useCallback(
    (dataToSave: T) => {
      if (typeof window === "undefined") return;

      try {
        const draft: SavedDraft<T> = {
          data: dataToSave,
          savedAt: Date.now(),
          version: CURRENT_VERSION,
        };

        localStorage.setItem(fullStorageKey, JSON.stringify(draft));
        setHasDraft(true);
        setLastSavedAt(new Date());
        onSave?.(dataToSave);
      } catch (error) {
        console.error("[AutoSave] Erreur de sauvegarde:", error);
      }
    },
    [fullStorageKey, onSave]
  );

  /**
   * Sauvegarde avec debounce
   */
  const debouncedSave = useCallback(
    (dataToSave: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        save(dataToSave);
      }, debounceMs);
    },
    [save, debounceMs]
  );

  /**
   * Restaure un brouillon sauvegardé
   */
  const restore = useCallback((): T | null => {
    const draft = checkForDraft();
    if (!draft) return null;

    setIsRestoring(true);

    if (showToasts) {
      toast({
        title: "Brouillon restauré",
        description: `Données sauvegardées le ${new Date(draft.savedAt).toLocaleString("fr-FR")}`,
      });
    }

    onRestore?.(draft.data);
    setIsRestoring(false);
    return draft.data;
  }, [checkForDraft, onRestore, showToasts, toast]);

  /**
   * Supprime le brouillon
   */
  const clear = useCallback(() => {
    if (typeof window === "undefined") return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    localStorage.removeItem(fullStorageKey);
    setHasDraft(false);
    setLastSavedAt(null);
  }, [fullStorageKey]);

  /**
   * Ignore le brouillon (le supprime sans restaurer)
   */
  const dismiss = useCallback(() => {
    clear();
    if (showToasts) {
      toast({
        title: "Brouillon supprimé",
        description: "Le brouillon a été ignoré",
      });
    }
  }, [clear, showToasts, toast]);

  // Vérifier s'il existe un brouillon au montage
  useEffect(() => {
    const draft = checkForDraft();
    setHasDraft(!!draft);
    if (draft) {
      setLastSavedAt(new Date(draft.savedAt));
    }
  }, [checkForDraft]);

  // Sauvegarder automatiquement quand les données changent
  useEffect(() => {
    // Ne pas sauvegarder si on est en train de restaurer
    if (isRestoring) return;

    // Ne pas sauvegarder si les données sont vides
    const hasData = Object.values(data).some(
      (v) => v !== null && v !== undefined && v !== "" && v !== 0
    );
    if (!hasData) return;

    debouncedSave(data);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, debouncedSave, isRestoring]);

  // Sauvegarder avant de quitter la page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Sauvegarder immédiatement
      save(data);

      // Afficher un message de confirmation si des données non sauvegardées
      const hasData = Object.values(data).some(
        (v) => v !== null && v !== undefined && v !== "" && v !== 0
      );
      if (hasData) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [data, save]);

  return {
    /** Indique si un brouillon existe */
    hasDraft,
    /** Date de la dernière sauvegarde */
    lastSavedAt,
    /** Restaure le brouillon */
    restore,
    /** Supprime le brouillon */
    clear,
    /** Ignore le brouillon */
    dismiss,
    /** Force une sauvegarde immédiate */
    saveNow: () => save(data),
    /** Récupère le brouillon sans le restaurer */
    getDraft: checkForDraft,
  };
}

/**
 * Composant de bannière pour restaurer un brouillon
 */
export function DraftBanner({
  hasDraft,
  lastSavedAt,
  onRestore,
  onDismiss,
}: {
  hasDraft: boolean;
  lastSavedAt: Date | null;
  onRestore: () => void;
  onDismiss: () => void;
}) {
  if (!hasDraft) return null;

  return (
    <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-yellow-600 dark:text-yellow-400">
          Un brouillon a été trouvé
          {lastSavedAt && (
            <span className="text-sm ml-1">
              (sauvegardé le {lastSavedAt.toLocaleString("fr-FR")})
            </span>
          )}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Ignorer
        </button>
        <button
          type="button"
          onClick={onRestore}
          className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
        >
          Restaurer
        </button>
      </div>
    </div>
  );
}

export default useAutoSave;
