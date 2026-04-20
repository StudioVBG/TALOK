"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "ok" | "warning" | "critical";

interface HealthCheck {
  name: string;
  status: Status;
  latency_ms?: number;
  message?: string;
  value?: number | string;
}

interface HealthResponse {
  status: Status;
  checked_at: string;
  checks: HealthCheck[];
}

export default function PlatformHealthPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "platform_admin"]}>
      <PlatformHealthContent />
    </ProtectedRoute>
  );
}

const STATUS_META: Record<Status, { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
  ok: {
    label: "Opérationnel",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    Icon: CheckCircle2,
  },
  warning: {
    label: "Avertissement",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    Icon: AlertCircle,
  },
  critical: {
    label: "Critique",
    className: "bg-red-500/10 text-red-600 border-red-500/30",
    Icon: AlertTriangle,
  },
};

function PlatformHealthContent() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<HealthResponse>({
    queryKey: ["admin", "platform-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/health");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur chargement santé plateforme");
      }
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const global = data?.status || "ok";
  const globalMeta = STATUS_META[global];
  const GlobalIcon = globalMeta.Icon;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6" /> Santé de la plateforme
          </h1>
          <p className="text-muted-foreground">
            Indicateurs temps réel — rafraîchi toutes les 30 secondes.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Actualiser
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1">{(error as Error).message}</p>
        </div>
      )}

      {!isLoading && data && (
        <>
          <Card
            className={cn(
              "border",
              global === "ok"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : global === "warning"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-red-500/30 bg-red-500/5"
            )}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div
                className={cn(
                  "inline-flex items-center justify-center w-14 h-14 rounded-full border-2",
                  globalMeta.className
                )}
              >
                <GlobalIcon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Statut global</p>
                <p className="text-2xl font-bold text-foreground">{globalMeta.label}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Dernière vérification :{" "}
                  {new Date(data.checked_at).toLocaleString("fr-FR")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Détails des contrôles</CardTitle>
              <CardDescription>
                {data.checks.length} contrôle{data.checks.length > 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.checks.map((c) => {
                const meta = STATUS_META[c.status];
                const Icon = meta.Icon;
                return (
                  <div
                    key={c.name}
                    className="flex items-start gap-3 rounded-lg border border-border bg-background p-4"
                  >
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full border shrink-0",
                        meta.className
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <Badge variant="outline">{meta.label}</Badge>
                        {typeof c.latency_ms === "number" && (
                          <Badge variant="outline">{c.latency_ms} ms</Badge>
                        )}
                        {c.value !== undefined && (
                          <Badge variant="outline">{c.value}</Badge>
                        )}
                      </div>
                      {c.message && (
                        <p className="text-sm text-muted-foreground mt-1">{c.message}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {isLoading && (
        <Card className="bg-card border-border">
          <CardContent className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
