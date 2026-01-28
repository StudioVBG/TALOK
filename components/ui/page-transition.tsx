"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * PageTransition - Animation légère pour les transitions de page
 *
 * Optimisations appliquées pour éviter le scintillement :
 * - Suppression de l'effet blur (coûteux en GPU et cause des repaints)
 * - Utilisation de opacity uniquement (composable par le GPU)
 * - Durée réduite pour une sensation plus fluide
 * - Mode wait pour éviter les superpositions d'animations
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 0.15,
          ease: "easeOut",
        }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
