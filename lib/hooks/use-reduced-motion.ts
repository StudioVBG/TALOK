"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if the user prefers reduced motion.
 * Useful for disabling framer-motion animations.
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * Returns animation variants that respect prefers-reduced-motion.
 * When reduced motion is preferred, all animations resolve to static values.
 */
export function useMotionVariants() {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return {
      container: {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
      },
      item: {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0 },
      },
    };
  }

  return {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: 0.06 },
      },
    },
    item: {
      hidden: { opacity: 0, y: 15 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 300, damping: 24 },
      },
    },
  };
}
