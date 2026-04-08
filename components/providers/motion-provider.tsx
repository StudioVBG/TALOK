"use client";

/**
 * Provider LazyMotion pour Framer Motion
 *
 * Charge uniquement les features d'animation necessaires (domAnimation)
 * au lieu du bundle complet. Gain: ~35 kB gzip.
 *
 * Les composants existants utilisant `motion.*` continuent de fonctionner.
 * Les nouveaux composants doivent utiliser `m.*` pour beneficier du lazy loading.
 *
 * Migration progressive: remplacer `motion.div` par `m.div` dans les composants
 * au fur et a mesure des modifications.
 */

import { LazyMotion, domAnimation } from "framer-motion";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict={false}>
      {children}
    </LazyMotion>
  );
}
