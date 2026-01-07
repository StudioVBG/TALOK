"use client";

/**
 * Hook pour gérer les raccourcis clavier globaux
 * Permet de définir des actions liées à des combinaisons de touches
 */

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface KeyboardShortcut {
  /** Touche principale (ex: "d", "b", "ArrowUp") */
  key: string;
  /** Modificateurs requis */
  modifiers?: {
    ctrl?: boolean;
    meta?: boolean; // ⌘ sur Mac
    shift?: boolean;
    alt?: boolean;
  };
  /** Action à exécuter */
  action: () => void;
  /** Description pour l'aide */
  description?: string;
  /** Désactiver dans les inputs */
  disableInInputs?: boolean;
}

interface UseKeyboardShortcutsOptions {
  /** Activer/désactiver les raccourcis */
  enabled?: boolean;
}

/**
 * Vérifie si l'élément actif est un champ de saisie
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.getAttribute("contenteditable") === "true"
  );
}

/**
 * Hook principal pour les raccourcis clavier
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Vérifier chaque raccourci
      for (const shortcut of shortcuts) {
        const { key, modifiers = {}, action, disableInInputs = true } = shortcut;

        // Ignorer dans les inputs si configuré
        if (disableInInputs && isInputElement(document.activeElement)) {
          continue;
        }

        // Vérifier la touche
        const keyMatch = event.key.toLowerCase() === key.toLowerCase();
        if (!keyMatch) continue;

        // Vérifier les modificateurs
        const ctrlMatch = modifiers.ctrl ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = modifiers.meta ? event.metaKey : !event.metaKey;
        const shiftMatch = modifiers.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = modifiers.alt ? event.altKey : !event.altKey;

        // Si combinaison ⌘ ou Ctrl acceptée
        const cmdOrCtrl = modifiers.meta || modifiers.ctrl;
        const cmdOrCtrlMatch = cmdOrCtrl
          ? event.metaKey || event.ctrlKey
          : !event.metaKey && !event.ctrlKey;

        if (
          keyMatch &&
          (cmdOrCtrl ? cmdOrCtrlMatch : ctrlMatch && metaMatch) &&
          shiftMatch &&
          altMatch
        ) {
          event.preventDefault();
          action();
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Raccourcis par défaut pour les propriétaires
 */
export function useOwnerShortcuts() {
  const router = useRouter();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: "d",
      modifiers: { meta: true },
      action: () => router.push("/owner/dashboard"),
      description: "Aller au tableau de bord",
    },
    {
      key: "b",
      modifiers: { meta: true },
      action: () => router.push("/owner/properties"),
      description: "Voir mes biens",
    },
    {
      key: "l",
      modifiers: { meta: true },
      action: () => router.push("/owner/tenants"),
      description: "Voir mes locataires",
    },
    {
      key: "c",
      modifiers: { meta: true },
      action: () => router.push("/owner/leases"),
      description: "Voir mes contrats",
    },
    {
      key: "m",
      modifiers: { meta: true },
      action: () => router.push("/owner/money"),
      description: "Voir mes finances",
    },
    {
      key: "n",
      modifiers: { meta: true, shift: true },
      action: () => router.push("/owner/properties/new"),
      description: "Ajouter un bien",
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}

/**
 * Composant d'affichage des raccourcis disponibles
 */
export function getShortcutLabel(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  const { modifiers = {} } = shortcut;

  if (modifiers.ctrl || modifiers.meta) parts.push("⌘");
  if (modifiers.shift) parts.push("⇧");
  if (modifiers.alt) parts.push("⌥");
  parts.push(shortcut.key.toUpperCase());

  return parts.join("");
}

export default useKeyboardShortcuts;

