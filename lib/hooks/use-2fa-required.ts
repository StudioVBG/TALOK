"use client";

/**
 * Hook pour vérifier et forcer l'activation du 2FA
 * 
 * SOTA 2026 - 2FA Obligatoire
 * ===========================
 * 
 * Ce hook vérifie si l'utilisateur doit activer le 2FA et
 * le redirige vers la page de configuration si nécessaire.
 * 
 * Cas où le 2FA est requis:
 * - Administrateurs (toujours)
 * - Propriétaires avec 5+ biens
 * - Comptes avec flag two_factor_required = true
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Use2FARequiredResult {
  isLoading: boolean;
  is2FARequired: boolean;
  is2FAEnabled: boolean;
  needsSetup: boolean;
  propertyCount: number;
  redirectTo2FASetup: () => void;
}

// Pages exemptées de la vérification 2FA (pour permettre la configuration)
const EXEMPT_PATHS = [
  "/auth",
  "/signup",
  "/settings/security",
  "/settings/2fa",
  "/api",
  "/_next",
];

export function use2FARequired(): Use2FARequiredResult {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [is2FARequired, setIs2FARequired] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [propertyCount, setPropertyCount] = useState(0);

  useEffect(() => {
    const checkRequirement = async () => {
      // Ne pas vérifier sur les pages exemptées
      if (EXEMPT_PATHS.some((path) => pathname?.startsWith(path))) {
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsLoading(false);
          return;
        }

        // Récupérer le profil avec les infos 2FA
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role, two_factor_required, two_factor_enabled")
          .eq("user_id", user.id)
          .single();

        if (!profile) {
          setIsLoading(false);
          return;
        }

        // Vérifier les flags 2FA
        setIs2FARequired(profile.two_factor_required || false);
        setIs2FAEnabled(profile.two_factor_enabled || false);

        // Si admin, 2FA toujours requis
        if (profile.role === "admin") {
          setIs2FARequired(true);
        }

        // Si propriétaire, compter les biens
        if (profile.role === "owner") {
          const { count } = await supabase
            .from("properties")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", profile.id)
            .is("deleted_at", null);

          setPropertyCount(count || 0);

          // 5+ biens = 2FA requis
          if ((count || 0) >= 5) {
            setIs2FARequired(true);
          }
        }
      } catch (error) {
        console.error("[2FA Check] Erreur:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkRequirement();
  }, [pathname]);

  // Calculer si l'utilisateur doit configurer le 2FA
  const needsSetup = is2FARequired && !is2FAEnabled;

  // Redirection vers la page de configuration 2FA
  const redirectTo2FASetup = useCallback(() => {
    router.push("/settings/security?setup=2fa");
  }, [router]);

  // Auto-redirection si 2FA requis mais non configuré
  useEffect(() => {
    if (!isLoading && needsSetup) {
      // Vérifier qu'on n'est pas déjà sur une page exemptée
      if (!EXEMPT_PATHS.some((path) => pathname?.startsWith(path))) {
        // Délai pour permettre l'affichage d'un message
        const timer = setTimeout(() => {
          router.push(`/settings/security?setup=2fa&return=${encodeURIComponent(pathname || "/")}`);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, needsSetup, pathname, router]);

  return {
    isLoading,
    is2FARequired,
    is2FAEnabled,
    needsSetup,
    propertyCount,
    redirectTo2FASetup,
  };
}

/**
 * Hook pour vérifier une session 2FA valide
 * À utiliser pour les opérations sensibles
 */
export function use2FASession() {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  useEffect(() => {
    const check2FASession = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsLoading(false);
          return;
        }

        // Vérifier s'il existe une session 2FA valide
        const { data: session } = await supabase
          .from("two_factor_sessions")
          .select("*")
          .eq("user_id", user.id)
          .gte("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (session) {
          setIsVerified(true);
          setExpiresAt(new Date(session.expires_at as string));
        }
      } catch (error) {
        console.error("[2FA Session] Erreur:", error);
      } finally {
        setIsLoading(false);
      }
    };

    check2FASession();
  }, []);

  return {
    isVerified,
    isLoading,
    expiresAt,
    // Temps restant en minutes
    minutesRemaining: expiresAt
      ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000))
      : 0,
  };
}

export default use2FARequired;

