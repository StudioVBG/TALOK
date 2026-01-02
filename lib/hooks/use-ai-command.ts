"use client";

/**
 * Hook pour gérer la Command Palette AI
 * SOTA 2026 - State management avec Zustand
 */

import { useCallback } from "react";
import { create } from "zustand";

// ============================================
// STORE
// ============================================

interface AICommandStore {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  
  // Context pour pré-remplir
  initialPrompt: string | null;
  setInitialPrompt: (prompt: string | null) => void;
  
  // Mode
  mode: "search" | "chat";
  setMode: (mode: "search" | "chat") => void;
}

export const useAICommandStore = create<AICommandStore>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  
  initialPrompt: null,
  setInitialPrompt: (prompt) => set({ initialPrompt: prompt }),
  
  mode: "search",
  setMode: (mode) => set({ mode }),
}));

// ============================================
// HOOK SIMPLIFIÉ
// ============================================

/**
 * Hook simplifié pour utiliser la command palette
 */
export function useAICommand() {
  const store = useAICommandStore();

  const open = useCallback(() => {
    store.setOpen(true);
  }, [store]);

  const close = useCallback(() => {
    store.setOpen(false);
    store.setInitialPrompt(null);
  }, [store]);

  const toggle = useCallback(() => {
    store.toggle();
  }, [store]);

  /**
   * Ouvre la palette avec un prompt pré-rempli
   */
  const openWithPrompt = useCallback(
    (prompt: string) => {
      store.setInitialPrompt(prompt);
      store.setMode("chat");
      store.setOpen(true);
    },
    [store]
  );

  /**
   * Ouvre la palette en mode chat
   */
  const openChat = useCallback(() => {
    store.setMode("chat");
    store.setOpen(true);
  }, [store]);

  /**
   * Ouvre la palette en mode recherche
   */
  const openSearch = useCallback(() => {
    store.setMode("search");
    store.setOpen(true);
  }, [store]);

  return {
    isOpen: store.isOpen,
    mode: store.mode,
    initialPrompt: store.initialPrompt,
    open,
    close,
    toggle,
    setOpen: store.setOpen,
    openWithPrompt,
    openChat,
    openSearch,
  };
}

// ============================================
// HOOK POUR RACCOURCI CLAVIER
// ============================================

/**
 * Hook qui enregistre le raccourci clavier global ⌘K / Ctrl+K
 * À utiliser dans le layout principal
 */
export function useAICommandShortcut() {
  const { toggle } = useAICommand();

  // L'effet est géré dans le composant AICommandPalette
  // Ce hook est pour les cas où on veut l'utiliser ailleurs

  return { toggle };
}

export default useAICommand;

