"use client";

/**
 * Provider Framer Motion global.
 *
 * 1. LazyMotion : charge uniquement les features d'animation necessaires
 *    (domAnimation) au lieu du bundle complet. Gain: ~35 kB gzip.
 *    Les composants existants utilisant `motion.*` continuent de fonctionner.
 *    Migration progressive : remplacer `motion.div` par `m.div`.
 *
 * 2. MotionConfig reducedMotion="user" : respecte automatiquement la
 *    preference systeme `prefers-reduced-motion: reduce`. Aucune
 *    modification des motion.div individuels n'est necessaire.
 *    Conforme RGAA 4.1 criteres 13.x et WCAG 2.1 AA guideline 2.3.3.
 */

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict={false}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
