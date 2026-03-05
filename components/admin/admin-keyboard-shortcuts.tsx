"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Raccourcis clavier globaux pour l'administration
 *
 * Shortcuts:
 * - G puis D : Aller au Dashboard
 * - G puis P : Aller aux People (Annuaire)
 * - G puis I : Aller aux Integrations
 * - G puis M : Aller a la Moderation
 * - G puis B : Aller au Blog
 * - G puis R : Aller aux Rapports
 * - G puis S : Aller aux Subscriptions
 * - G puis T : Aller aux Templates
 * - ? : Afficher l'aide raccourcis (via event custom)
 */

const SHORTCUTS: Record<string, string> = {
  d: "/admin/dashboard",
  p: "/admin/people",
  i: "/admin/integrations",
  m: "/admin/moderation",
  b: "/admin/blog",
  r: "/admin/reports",
  s: "/admin/subscriptions",
  t: "/admin/templates",
  f: "/admin/plans",
  a: "/admin/accounting",
  c: "/admin/compliance",
};

export function AdminKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout>;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignorer si on est dans un input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ignorer si un modifier est presse (sauf pour Cmd+K qui est gere par la sidebar)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // "G" chord - premiere touche
      if (e.key === "g" && !gPressed) {
        gPressed = true;
        // Reset apres 1.5s si pas de deuxieme touche
        gTimeout = setTimeout(() => {
          gPressed = false;
        }, 1500);
        return;
      }

      // Deuxieme touche du chord "G + X"
      if (gPressed) {
        gPressed = false;
        clearTimeout(gTimeout);

        const route = SHORTCUTS[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          router.push(route);
        }
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(gTimeout);
    };
  }, [router]);

  // Ce composant ne rend rien - il gere uniquement les events clavier
  return null;
}
