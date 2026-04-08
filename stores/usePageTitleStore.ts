"use client";

/**
 * Store Zustand léger pour le titre de page dynamique.
 *
 * Les pages de détail (bail, bien, etc.) peuvent appeler `setPageTitle()`
 * pour remplacer le titre générique du header layout par un titre contextuel.
 * Le titre est automatiquement nettoyé quand la page démonte.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface PageTitleState {
  /** Titre contextuel défini par la page enfant, ou null pour utiliser le titre de navigation par défaut */
  overrideTitle: string | null;
  setPageTitle: (title: string | null) => void;
}

export const usePageTitleStore = create<PageTitleState>()(
  devtools(
    (set) => ({
      overrideTitle: null,
      setPageTitle: (title) => set({ overrideTitle: title }),
    }),
    { name: "PageTitleStore", enabled: process.env.NODE_ENV === "development" }
  )
);
