"use client";

/**
 * P2-9: Auto-save hook for wizard forms
 *
 * Saves form state to localStorage on every change (debounced).
 * Restores on mount if a saved state exists.
 * Clears on explicit submit.
 */

import { useEffect, useRef, useCallback } from "react";

interface UseAutoSaveOptions<T> {
  /** Unique key for this form (e.g., "lease-wizard" or "edl-wizard") */
  key: string;
  /** Current form data */
  data: T;
  /** Debounce delay in ms (default 1000) */
  debounceMs?: number;
  /** Called when restored data is found on mount */
  onRestore?: (data: T) => void;
  /** Whether auto-save is enabled */
  enabled?: boolean;
}

export function useAutoSave<T>({
  key,
  data,
  debounceMs = 1000,
  onRestore,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const storageKey = `talok-autosave-${key}`;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  // Restore on mount
  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.data && parsed.savedAt) {
          // Only restore if saved within last 24h
          const age = Date.now() - parsed.savedAt;
          if (age < 24 * 60 * 60 * 1000) {
            onRestore?.(parsed.data);
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      }
    } catch {
      // Silently ignore parse errors
    }
  }, [storageKey, onRestore, enabled]);

  // Save on change (debounced)
  useEffect(() => {
    if (!enabled) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ data, savedAt: Date.now() })
        );
      } catch {
        // Storage full — silently fail
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, storageKey, debounceMs, enabled]);

  // Clear saved state (call on successful submit)
  const clearSaved = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  // Check if there's a saved state
  const hasSavedState = useCallback((): boolean => {
    try {
      return !!localStorage.getItem(storageKey);
    } catch {
      return false;
    }
  }, [storageKey]);

  return { clearSaved, hasSavedState };
}
