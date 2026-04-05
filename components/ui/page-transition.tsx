"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * PageTransition - Animation légère pour les transitions de page
 *
 * Fix du bug "page blanche" au retour sur l'accueil :
 * - Suppression du mode="wait" qui causait un écran blanc entre les pages
 * - Suppression de l'animation exit (plus de fade-out → fade-in)
 * - Seul le fade-in au chargement est conservé (entrée douce)
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.2,
          ease: "easeOut",
        }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
