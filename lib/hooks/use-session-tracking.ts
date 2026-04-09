"use client";

import { useEffect, useRef } from "react";

/**
 * useSessionTracking — Enregistre/met à jour la session active de l'utilisateur.
 * À utiliser dans un layout authentifié (ex: OwnerLayout, TenantLayout).
 *
 * Appelle POST /api/auth/sessions une seule fois au montage du composant
 * pour enregistrer la session courante (device, IP, user agent).
 */
export function useSessionTracking(isAuthenticated: boolean) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || tracked.current) return;
    tracked.current = true;

    fetch("/api/auth/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch((err) => {
      // Non-blocking — session tracking failure should not break the app
      console.warn("[SessionTracking] Failed to record session:", err);
    });
  }, [isAuthenticated]);
}
