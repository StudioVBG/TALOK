"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { OrganizationBranding, DEFAULT_BRANDING, WhiteLabelLevel } from "@/lib/white-label/types";

// ============================================
// TYPES
// ============================================

interface BrandingContextValue {
  // État
  branding: Partial<OrganizationBranding>;
  isLoading: boolean;
  isCustomDomain: boolean;
  organizationId: string | null;
  whiteLabelLevel: WhiteLabelLevel;

  // Computed
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  showPoweredBy: boolean;

  // Actions
  refreshBranding: () => Promise<void>;
}

interface BrandingProviderProps {
  children: ReactNode;
  initialBranding?: Partial<OrganizationBranding>;
  organizationId?: string;
}

// ============================================
// CONTEXT
// ============================================

const BrandingContext = createContext<BrandingContextValue | null>(null);

// ============================================
// HOOKS
// ============================================

/**
 * Hook pour accéder au branding
 */
export function useBranding(): BrandingContextValue {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return context;
}

/**
 * Hook pour les couleurs du branding
 */
export function useBrandingColors() {
  const { primaryColor, secondaryColor, accentColor } = useBranding();
  return { primaryColor, secondaryColor, accentColor };
}

/**
 * Hook pour le logo
 */
export function useBrandingLogo() {
  const { logoUrl, companyName } = useBranding();
  return { logoUrl, companyName };
}

// ============================================
// HELPERS
// ============================================

/**
 * Convertit une couleur hex en HSL pour les CSS variables
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Enlever le # si présent
  hex = hex.replace(/^#/, "");

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Génère le CSS string pour une couleur HSL
 */
function hslToCSSVar(hsl: { h: number; s: number; l: number }): string {
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

/**
 * Applique les variables CSS au document
 */
function applyBrandingCSS(branding: Partial<OrganizationBranding>) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Couleur primaire
  if (branding.primary_color) {
    const primary = hexToHSL(branding.primary_color);
    root.style.setProperty("--primary", hslToCSSVar(primary));
    // Variante pour le ring
    root.style.setProperty("--ring", hslToCSSVar(primary));
  }

  // Couleur secondaire (utilisée pour accent dans certains cas)
  if (branding.secondary_color) {
    const secondary = hexToHSL(branding.secondary_color);
    root.style.setProperty("--secondary", hslToCSSVar(secondary));
  }

  // Couleur d'accent
  if (branding.accent_color) {
    const accent = hexToHSL(branding.accent_color);
    root.style.setProperty("--accent", hslToCSSVar(accent));
  }

  // CSS personnalisé (niveau premium uniquement)
  if (branding.custom_css) {
    let styleEl = document.getElementById("branding-custom-css");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "branding-custom-css";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = branding.custom_css;
  }
}

/**
 * Retire les variables CSS custom
 */
function removeBrandingCSS() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.removeProperty("--primary");
  root.style.removeProperty("--secondary");
  root.style.removeProperty("--accent");
  root.style.removeProperty("--ring");

  const styleEl = document.getElementById("branding-custom-css");
  if (styleEl) {
    styleEl.remove();
  }
}

// ============================================
// PROVIDER
// ============================================

export function BrandingProvider({
  children,
  initialBranding,
  organizationId: initialOrgId,
}: BrandingProviderProps) {
  const [branding, setBranding] = useState<Partial<OrganizationBranding>>(
    initialBranding || DEFAULT_BRANDING
  );
  const [isLoading, setIsLoading] = useState(!initialBranding);
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(
    initialOrgId || null
  );
  const [whiteLabelLevel, setWhiteLabelLevel] = useState<WhiteLabelLevel>("none");

  // Charger le branding au montage
  useEffect(() => {
    const loadBranding = async () => {
      // Vérifier si on est sur un domaine custom
      if (typeof window === "undefined") return;

      const hostname = window.location.hostname;
      const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
      const isTalokDomain =
        hostname.endsWith("talok.fr") || hostname.endsWith("talok.app");

      if (isLocalhost || isTalokDomain) {
        // Domaine Talok standard
        setIsLoading(false);
        return;
      }

      // Domaine personnalisé - charger le branding
      setIsCustomDomain(true);
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/white-label/resolve?domain=${encodeURIComponent(hostname)}`
        );
        const data = await response.json();

        if (data.success && data.isCustomDomain) {
          setBranding(data.branding);
          setOrganizationId(data.organization?.id || null);
          setWhiteLabelLevel(data.organization?.whiteLabelLevel || "none");
        }
      } catch (err) {
        console.error("Erreur chargement branding:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (!initialBranding) {
      loadBranding();
    }
  }, [initialBranding]);

  // Appliquer le CSS quand le branding change
  useEffect(() => {
    applyBrandingCSS(branding);

    return () => {
      // Nettoyer seulement si on est sur un domaine custom
      if (isCustomDomain) {
        removeBrandingCSS();
      }
    };
  }, [branding, isCustomDomain]);

  // Action pour rafraîchir le branding
  const refreshBranding = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/white-label/resolve?domain=${encodeURIComponent(window.location.hostname)}`
      );
      const data = await response.json();

      if (data.success && data.branding) {
        setBranding(data.branding);
      }
    } catch (err) {
      console.error("Erreur refresh branding:", err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  // Valeurs computed
  const companyName = branding.company_name || DEFAULT_BRANDING.company_name || "Talok";
  const logoUrl = branding.logo_url || null;
  const primaryColor = branding.primary_color || DEFAULT_BRANDING.primary_color!;
  const secondaryColor = branding.secondary_color || DEFAULT_BRANDING.secondary_color!;
  const accentColor = branding.accent_color || DEFAULT_BRANDING.accent_color!;
  const showPoweredBy = !branding.remove_powered_by;

  const value: BrandingContextValue = {
    branding,
    isLoading,
    isCustomDomain,
    organizationId,
    whiteLabelLevel,
    companyName,
    logoUrl,
    primaryColor,
    secondaryColor,
    accentColor,
    showPoweredBy,
    refreshBranding,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

// ============================================
// COMPONENTS
// ============================================

/**
 * Logo brandé avec fallback
 */
export function BrandedLogo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { logoUrl, companyName, primaryColor } = useBranding();

  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-12",
  };

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={companyName}
        className={`${sizeClasses[size]} w-auto ${className || ""}`}
      />
    );
  }

  return (
    <span
      className={`font-bold ${size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-xl"} ${className || ""}`}
      style={{ color: primaryColor }}
    >
      🏠 {companyName}
    </span>
  );
}

/**
 * Footer avec "Powered by" conditionnel
 */
export function BrandedFooter({ className }: { className?: string }) {
  const { showPoweredBy, companyName } = useBranding();

  return (
    <footer className={`text-center text-sm text-slate-500 ${className || ""}`}>
      <p>© {new Date().getFullYear()} {companyName}. Tous droits réservés.</p>
      {showPoweredBy && (
        <p className="mt-1 text-xs text-slate-400">
          Propulsé par{" "}
          <a
            href="https://talok.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-600 underline"
          >
            Talok
          </a>
        </p>
      )}
    </footer>
  );
}

/**
 * Bouton avec couleur primaire du branding
 */
export function BrandedButton({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline";
}) {
  const { primaryColor, secondaryColor } = useBranding();

  const baseClasses =
    "inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors";

  const variantStyles = {
    primary: {
      backgroundColor: primaryColor,
      color: "white",
    },
    secondary: {
      backgroundColor: secondaryColor,
      color: "white",
    },
    outline: {
      backgroundColor: "transparent",
      border: `2px solid ${primaryColor}`,
      color: primaryColor,
    },
  };

  return (
    <button
      className={`${baseClasses} ${className || ""}`}
      style={variantStyles[variant]}
      {...props}
    >
      {children}
    </button>
  );
}

export default BrandingProvider;
