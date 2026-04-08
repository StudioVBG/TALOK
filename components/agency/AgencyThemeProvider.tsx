"use client";

import { useEffect } from "react";

interface AgencyThemeProviderProps {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string | null;
  brandName?: string;
  children: React.ReactNode;
}

/**
 * AgencyThemeProvider — Injects CSS custom properties for white-label theming.
 *
 * CSS variables injected:
 * --wl-primary: Primary brand color
 * --wl-secondary: Secondary brand color
 * --wl-font: Font family
 * --wl-logo: URL of the logo (as a CSS custom property)
 * --wl-brand: Brand name (as a CSS custom property)
 *
 * These are applied dynamically without requiring a rebuild.
 */
export function AgencyThemeProvider({
  primaryColor = "#2563EB",
  secondaryColor,
  fontFamily = "Manrope",
  logoUrl,
  brandName,
  children,
}: AgencyThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--wl-primary", primaryColor);

    if (secondaryColor) {
      root.style.setProperty("--wl-secondary", secondaryColor);
    }

    root.style.setProperty("--wl-font", fontFamily);

    if (logoUrl) {
      root.style.setProperty("--wl-logo", `url(${logoUrl})`);
    }

    if (brandName) {
      root.style.setProperty("--wl-brand", `"${brandName}"`);
    }

    // Generate lighter/darker variants for primary
    const hex = primaryColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    root.style.setProperty("--wl-primary-rgb", `${r}, ${g}, ${b}`);
    root.style.setProperty("--wl-primary-light", `rgba(${r}, ${g}, ${b}, 0.1)`);
    root.style.setProperty("--wl-primary-hover", `rgba(${r}, ${g}, ${b}, 0.9)`);

    return () => {
      root.style.removeProperty("--wl-primary");
      root.style.removeProperty("--wl-secondary");
      root.style.removeProperty("--wl-font");
      root.style.removeProperty("--wl-logo");
      root.style.removeProperty("--wl-brand");
      root.style.removeProperty("--wl-primary-rgb");
      root.style.removeProperty("--wl-primary-light");
      root.style.removeProperty("--wl-primary-hover");
    };
  }, [primaryColor, secondaryColor, fontFamily, logoUrl, brandName]);

  return <>{children}</>;
}
