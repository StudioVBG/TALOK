"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Monitor, Smartphone, Tablet, Loader2, Shield, LogOut } from "lucide-react";

type ActiveSession = {
  id: string;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
};

function detectDeviceType(ua: string | null): "desktop" | "mobile" | "tablet" {
  if (!ua) return "desktop";
  const lc = ua.toLowerCase();
  if (lc.includes("mobile") || lc.includes("iphone") || lc.includes("android"))
    return lc.includes("ipad") ? "tablet" : "mobile";
  if (lc.includes("ipad") || lc.includes("tablet")) return "tablet";
  return "desktop";
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "à l'instant";
  if (ms < 3600_000) return `il y a ${Math.floor(ms / 60_000)} min`;
  if (ms < 86400_000) return `il y a ${Math.floor(ms / 3600_000)} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

/**
 * ActiveSessionsCard — Affiche et permet de révoquer les sessions actives
 *
 * Réutilisable dans owner/settings, tenant/settings, syndic/settings, etc.
 */
export function ActiveSessionsCard() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/sessions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch (err) {
      console.error("[ActiveSessionsCard] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = async (id: string, isCurrent: boolean) => {
    if (isCurrent) {
      toast({
        title: "Session courante",
        description: "Pour vous déconnecter de cet appareil, utilisez le bouton de déconnexion.",
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm("Révoquer cette session ?")) return;
    setRevoking(id);
    try {
      const res = await fetch(`/api/auth/sessions/${id}/revoke`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      toast({
        title: "Session révoquée",
        description: "L'appareil sera déconnecté à son prochain rafraîchissement.",
      });
      await load();
    } catch (err) {
      toast({
        title: "Échec de la révocation",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setRevoking(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Sessions actives
        </CardTitle>
        <CardDescription>
          Liste des appareils connectés à votre compte. Révoquez ceux que vous ne reconnaissez pas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucune session active enregistrée.
          </p>
        ) : (
          sessions.map((s) => {
            const deviceType = detectDeviceType(s.user_agent);
            const Icon =
              deviceType === "mobile"
                ? Smartphone
                : deviceType === "tablet"
                ? Tablet
                : Monitor;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-5 h-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {s.device_name ||
                        (s.user_agent
                          ? s.user_agent.split(" ")[0]
                          : "Appareil inconnu")}
                      {s.is_current && (
                        <Badge variant="default" className="ml-2 text-[10px]">
                          Cet appareil
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.ip_address ? `${s.ip_address} · ` : ""}Active{" "}
                      {formatRelative(s.last_active_at)}
                    </p>
                  </div>
                </div>
                {!s.is_current && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRevoke(s.id, s.is_current)}
                    disabled={revoking === s.id}
                  >
                    {revoking === s.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <LogOut className="w-3 h-3 mr-1" />
                        Révoquer
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
