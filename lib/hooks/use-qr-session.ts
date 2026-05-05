"use client";

/**
 * useQRSession - Hook desktop pour le pattern QR Talok
 *
 * - Crée une session QR via /api/qr/sessions/create
 * - S'abonne en realtime aux changements de status (pending → scanned → confirmed)
 * - Redirige automatiquement vers session.redirect_url quand status === 'confirmed'
 * - Permet de relancer (regenerate) une session expirée
 *
 * Usage :
 * ```tsx
 * const { qrDataUrl, status, create, expiresAt } = useQRSession({
 *   kind: "key_handover",
 *   payload: { leaseId },
 *   redirectUrl: `/owner/leases/${leaseId}`,
 * });
 *
 * useEffect(() => { create(); }, [create]);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type QRSessionKind =
  | "mobile_signin"
  | "key_handover"
  | "document_signature"
  | "lease_signature"
  | "edl_signature"
  | "2fa_setup_companion";

export type QRSessionStatus = "pending" | "scanned" | "confirmed" | "expired" | "consumed";

export interface UseQRSessionOptions {
  kind: QRSessionKind;
  payload?: Record<string, unknown>;
  redirectUrl?: string;
  targetUserId?: string;
  ttlSeconds?: number;
  /** Si true, redirige automatiquement vers redirectUrl à la confirmation. Défaut true. */
  autoRedirect?: boolean;
  /** Callback quand la session passe à 'confirmed'. */
  onConfirmed?: (session: { id: string; redirectUrl: string | null }) => void;
  /** Callback quand le mobile a scanné mais pas encore confirmé. */
  onScanned?: () => void;
}

export interface UseQRSessionResult {
  sessionId: string | null;
  qrDataUrl: string | null;
  scanUrl: string | null;
  status: QRSessionStatus;
  expiresAt: Date | null;
  loading: boolean;
  error: string | null;
  create: () => Promise<void>;
  reset: () => void;
}

export function useQRSession(options: UseQRSessionOptions): UseQRSessionResult {
  const { autoRedirect = true } = options;
  const router = useRouter();
  const supabase = createClient();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<QRSessionStatus>("pending");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optsRef = useRef(options);
  optsRef.current = options;

  const reset = useCallback(() => {
    setSessionId(null);
    setQrDataUrl(null);
    setScanUrl(null);
    setStatus("pending");
    setExpiresAt(null);
    setError(null);
  }, []);

  const create = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/qr/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: optsRef.current.kind,
          payload: optsRef.current.payload || {},
          redirectUrl: optsRef.current.redirectUrl,
          targetUserId: optsRef.current.targetUserId,
          ttlSeconds: optsRef.current.ttlSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur création session");

      setSessionId(data.sessionId);
      setQrDataUrl(data.qrDataUrl);
      setScanUrl(data.scanUrl);
      setStatus("pending");
      setExpiresAt(new Date(data.expiresAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime subscription sur la session courante
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`qr-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "qr_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const next = payload.new as {
            status: QRSessionStatus;
            redirect_url: string | null;
            id: string;
          };
          setStatus(next.status);

          if (next.status === "scanned") {
            optsRef.current.onScanned?.();
          }

          if (next.status === "confirmed") {
            optsRef.current.onConfirmed?.({
              id: next.id,
              redirectUrl: next.redirect_url,
            });
            if (autoRedirect && next.redirect_url) {
              router.push(next.redirect_url);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, supabase, router, autoRedirect]);

  // Expiration locale (UI feedback en cas de TTL atteint sans realtime event)
  useEffect(() => {
    if (!expiresAt) return;
    const ms = expiresAt.getTime() - Date.now();
    if (ms <= 0) {
      setStatus("expired");
      return;
    }
    const t = setTimeout(() => setStatus((s) => (s === "pending" || s === "scanned" ? "expired" : s)), ms);
    return () => clearTimeout(t);
  }, [expiresAt]);

  return {
    sessionId,
    qrDataUrl,
    scanUrl,
    status,
    expiresAt,
    loading,
    error,
    create,
    reset,
  };
}
