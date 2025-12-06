"use client";

/**
 * Bannière d'impersonation
 * 
 * Affiche une bannière visuelle quand un admin est en mode impersonation.
 * OBLIGATOIRE pour la transparence et la sécurité.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, X, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImpersonationSession {
  admin_email: string;
  target_user_id: string;
  target_email: string;
  target_role: string;
  started_at: string;
  expires_at: string;
  remaining_minutes: number;
}

export function ImpersonationBanner() {
  const [session, setSession] = useState<ImpersonationSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
    // Vérifier toutes les minutes
    const interval = setInterval(checkSession, 60000);
    return () => clearInterval(interval);
  }, []);

  const checkSession = async () => {
    try {
      const response = await fetch("/api/admin/impersonate");
      const data = await response.json();
      
      if (data.active && data.session) {
        setSession(data.session);
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error("Erreur vérification impersonation:", error);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    try {
      await fetch("/api/admin/impersonate", { method: "DELETE" });
      setSession(null);
      // Recharger la page pour revenir à l'état normal
      window.location.reload();
    } catch (error) {
      console.error("Erreur fin session:", error);
    }
  };

  if (loading || !session) {
    return null;
  }

  const isExpiringSoon = session.remaining_minutes < 10;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[9999] px-4 py-2",
        "bg-gradient-to-r from-orange-500 to-red-500",
        "text-white shadow-lg",
        "flex items-center justify-between gap-4"
      )}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 animate-pulse" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
          <span className="font-semibold">
            🎭 Mode Impersonation
          </span>
          <div className="flex items-center gap-2 text-sm opacity-90">
            <User className="h-4 w-4" />
            <span>
              {session.target_email} ({session.target_role})
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex items-center gap-1 text-sm",
            isExpiringSoon && "text-yellow-200 font-semibold animate-pulse"
          )}
        >
          <Clock className="h-4 w-4" />
          <span>
            {session.remaining_minutes} min restantes
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={endSession}
          className="bg-white/20 border-white/40 hover:bg-white/30 text-white"
        >
          <X className="h-4 w-4 mr-1" />
          Terminer
        </Button>
      </div>
    </div>
  );
}

/**
 * Hook pour vérifier si on est en mode impersonation
 */
export function useImpersonation() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [session, setSession] = useState<ImpersonationSession | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/admin/impersonate");
        const data = await response.json();
        setIsImpersonating(data.active);
        setSession(data.session || null);
      } catch {
        setIsImpersonating(false);
        setSession(null);
      }
    };

    checkSession();
  }, []);

  return { isImpersonating, session };
}

export default ImpersonationBanner;

