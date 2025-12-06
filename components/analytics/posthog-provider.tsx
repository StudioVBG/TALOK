"use client";

/**
 * PostHog Provider Component
 * 
 * Wrapper pour initialiser PostHog et tracker les pages vues automatiquement.
 * À ajouter dans app/layout.tsx
 */

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog, { initPostHog, identify, trackPageView } from "@/lib/analytics/posthog";

interface PostHogProviderProps {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialiser PostHog au montage
  useEffect(() => {
    initPostHog();
  }, []);

  // Tracker les changements de page
  useEffect(() => {
    if (pathname) {
      const url = searchParams?.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      
      trackPageView(url);
    }
  }, [pathname, searchParams]);

  return <>{children}</>;
}

/**
 * Hook pour identifier l'utilisateur après connexion
 */
export function useIdentifyUser() {
  const identifyUser = (user: {
    id: string;
    email?: string;
    role?: "owner" | "tenant" | "provider" | "admin";
    plan?: string;
    properties_count?: number;
    created_at?: string;
  }) => {
    identify(user);
  };

  return { identifyUser };
}

/**
 * Hook pour tracker des événements custom
 */
export function useTrack() {
  const track = (event: string, properties?: Record<string, any>) => {
    posthog.track(event, properties);
  };

  return { track };
}

export default PostHogProvider;

