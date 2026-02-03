"use client";

import { useState, useEffect } from "react";

/**
 * useMediaQuery - Hook pour détecter les breakpoints responsive
 *
 * Usage:
 * ```tsx
 * const isMobile = useMediaQuery("(max-width: 767px)");
 * const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
 * const isDesktop = useMediaQuery("(min-width: 1024px)");
 * const isTouchDevice = useMediaQuery("(pointer: coarse)");
 * const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * useBreakpoint - Hook pour détecter le breakpoint courant
 * Compatible avec les breakpoints Tailwind
 */
export function useBreakpoint() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isXL = useMediaQuery("(min-width: 1280px)");

  return {
    isMobile,
    isTablet,
    isDesktop,
    isXL,
    // Derived helpers
    isMobileOrTablet: isMobile || isTablet,
    isTabletOrDesktop: isTablet || isDesktop,
  };
}

/**
 * useIsTouchDevice - Détecte si l'utilisateur est sur un appareil tactile
 */
export function useIsTouchDevice(): boolean {
  return useMediaQuery("(pointer: coarse)");
}

/**
 * usePrefersReducedMotion - Détecte la préférence de mouvement réduit
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
