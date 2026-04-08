"use client";

/**
 * Initialise @axe-core/react en mode developpement uniquement.
 * Analyse automatiquement l'accessibilite (WCAG 2.1) et affiche
 * les violations dans la console du navigateur.
 *
 * Zero impact en production — le composant rend null et n'importe rien.
 */

import { useEffect } from "react";

export function AccessibilityProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      import("@axe-core/react").then((axe) => {
        import("react-dom").then((ReactDOM) => {
          axe.default(
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("react"),
            ReactDOM,
            1000 // delay in ms between checks
          );
        });
      });
    }
  }, []);

  return null;
}
