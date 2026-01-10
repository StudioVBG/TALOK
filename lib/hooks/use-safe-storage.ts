// =====================================================
// Hook useLocalStorage sécurisé - SOTA 2026
// Protection contre les erreurs de quota et storage désactivé
// =====================================================

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * Options pour le hook useLocalStorage
 */
interface UseLocalStorageOptions<T> {
  /** Valeur initiale si rien n'est stocké */
  defaultValue: T;
  /** Fonction de sérialisation (JSON.stringify par défaut) */
  serialize?: (value: T) => string;
  /** Fonction de désérialisation (JSON.parse par défaut) */
  deserialize?: (value: string) => T;
  /** Callback en cas d'erreur */
  onError?: (error: Error, action: "read" | "write" | "remove") => void;
}

/**
 * Vérifie si localStorage est disponible
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook useLocalStorage sécurisé
 *
 * @param key - Clé de stockage
 * @param options - Options de configuration
 * @returns [value, setValue, removeValue, error]
 *
 * @example
 * ```tsx
 * const [favorites, setFavorites, removeFavorites, error] = useLocalStorage<string[]>('favorites', {
 *   defaultValue: [],
 *   onError: (err) => console.error('Storage error:', err)
 * });
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  options: UseLocalStorageOptions<T>
): [T, (value: T | ((prev: T) => T)) => void, () => void, Error | null] {
  const {
    defaultValue,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    onError,
  } = options;

  const [error, setError] = useState<Error | null>(null);
  const [storedValue, setStoredValue] = useState<T>(defaultValue);
  const [isInitialized, setIsInitialized] = useState(false);

  // Lecture initiale depuis localStorage
  useEffect(() => {
    if (!isLocalStorageAvailable()) {
      setIsInitialized(true);
      return;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(deserialize(item));
      }
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to read from localStorage");
      setError(error);
      onError?.(error, "read");
      // On garde la valeur par défaut en cas d'erreur de lecture
    } finally {
      setIsInitialized(true);
    }
  }, [key, deserialize, onError, defaultValue]);

  // Écriture dans localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        // Supporter les fonctions de mise à jour
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);

        if (!isLocalStorageAvailable()) {
          return;
        }

        window.localStorage.setItem(key, serialize(valueToStore));
        setError(null);

        // Déclencher un event pour synchroniser les onglets
        window.dispatchEvent(
          new StorageEvent("storage", {
            key,
            newValue: serialize(valueToStore),
          })
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to write to localStorage");
        setError(error);
        onError?.(error, "write");

        // Gérer les erreurs de quota
        if (
          err instanceof DOMException &&
          (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
        ) {
          // Tenter de nettoyer le cache local
          try {
            clearOldCacheEntries();
            // Réessayer l'écriture après nettoyage
            window.localStorage.setItem(key, serialize(value instanceof Function ? value(storedValue) : value));
            setError(null);
          } catch {
            // Échec même après nettoyage
          }
        }
      }
    },
    [key, storedValue, serialize, onError]
  );

  // Suppression de localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue);

      if (!isLocalStorageAvailable()) {
        return;
      }

      window.localStorage.removeItem(key);
      setError(null);

      // Déclencher un event pour synchroniser les onglets
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: null,
        })
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to remove from localStorage");
      setError(error);
      onError?.(error, "remove");
    }
  }, [key, defaultValue, onError]);

  // Synchronisation entre onglets
  useEffect(() => {
    if (!isLocalStorageAvailable()) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        try {
          if (event.newValue === null) {
            setStoredValue(defaultValue);
          } else {
            setStoredValue(deserialize(event.newValue));
          }
          setError(null);
        } catch (err) {
          const error = err instanceof Error ? err : new Error("Failed to sync storage");
          setError(error);
          onError?.(error, "read");
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, defaultValue, deserialize, onError]);

  return [storedValue, setValue, removeValue, error];
}

/**
 * Hook useSessionStorage sécurisé
 * Même API que useLocalStorage mais pour sessionStorage
 */
export function useSessionStorage<T>(
  key: string,
  options: UseLocalStorageOptions<T>
): [T, (value: T | ((prev: T) => T)) => void, () => void, Error | null] {
  const {
    defaultValue,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    onError,
  } = options;

  const [error, setError] = useState<Error | null>(null);
  const [storedValue, setStoredValue] = useState<T>(defaultValue);

  // Vérifier si sessionStorage est disponible
  const isAvailable = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const testKey = "__session_test__";
      window.sessionStorage.setItem(testKey, testKey);
      window.sessionStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Lecture initiale
  useEffect(() => {
    if (!isAvailable) return;

    try {
      const item = window.sessionStorage.getItem(key);
      if (item !== null) {
        setStoredValue(deserialize(item));
      }
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to read from sessionStorage");
      setError(error);
      onError?.(error, "read");
    }
  }, [key, deserialize, onError, isAvailable]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);

        if (!isAvailable) return;

        window.sessionStorage.setItem(key, serialize(valueToStore));
        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to write to sessionStorage");
        setError(error);
        onError?.(error, "write");
      }
    },
    [key, storedValue, serialize, onError, isAvailable]
  );

  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue);
      if (!isAvailable) return;
      window.sessionStorage.removeItem(key);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to remove from sessionStorage");
      setError(error);
      onError?.(error, "remove");
    }
  }, [key, defaultValue, onError, isAvailable]);

  return [storedValue, setValue, removeValue, error];
}

/**
 * Nettoie les entrées de cache anciennes pour libérer de l'espace
 */
function clearOldCacheEntries(): void {
  if (!isLocalStorageAvailable()) return;

  // Patterns de clés de cache à nettoyer en priorité
  const cachePatterns = [
    /^cache_/,
    /^temp_/,
    /_cache$/,
    /^draft_/,
  ];

  const keysToRemove: string[] = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && cachePatterns.some((pattern) => pattern.test(key))) {
      keysToRemove.push(key);
    }
  }

  // Supprimer les clés de cache
  keysToRemove.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignorer les erreurs de suppression
    }
  });
}

/**
 * Helpers pour lecture/écriture sécurisées ponctuelles
 */
export const safeStorage = {
  /**
   * Lit une valeur depuis localStorage de manière sécurisée
   */
  getItem<T>(key: string, defaultValue: T): T {
    if (!isLocalStorageAvailable()) return defaultValue;

    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  /**
   * Écrit une valeur dans localStorage de manière sécurisée
   */
  setItem<T>(key: string, value: T): boolean {
    if (!isLocalStorageAvailable()) return false;

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      // Tenter de nettoyer et réessayer
      try {
        clearOldCacheEntries();
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }
  },

  /**
   * Supprime une valeur de localStorage de manière sécurisée
   */
  removeItem(key: string): boolean {
    if (!isLocalStorageAvailable()) return false;

    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Vérifie si localStorage est disponible
   */
  isAvailable(): boolean {
    return isLocalStorageAvailable();
  },
};

export default useLocalStorage;
