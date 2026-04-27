// @ts-nocheck
"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import {
  Building2,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

type Client = {
  entityId: string;
  entityName: string;
  exerciseStatus: string;
  entryCount: number;
  annotationCount: number;
};

export default function ECDashboardClient() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<any>({
    queryKey: ["ec-dashboard"],
    queryFn: () => apiClient.get("/accounting/ec/dashboard"),
    retry: 1,
  });

  const clients = (data?.data?.clients ?? data?.clients ?? []) as Client[];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          Portail Expert-Comptable
        </h1>
        {!isLoading && (
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 disabled:opacity-50"
            aria-label="Rafraîchir la liste des clients"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            Rafraîchir
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-muted rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-destructive">
                Impossible de charger vos clients
              </p>
              <p className="text-xs text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : "Erreur inattendue. Réessayez ou contactez le support."}
              </p>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="mt-2 text-xs px-3 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`}
                />
                Réessayer
              </button>
            </div>
          </div>
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <p className="text-muted-foreground">Aucun client connecté.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Demandez à votre client de vous inviter depuis son espace
            Talok &mdash; Comptabilité &gt; Expert-comptable.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {clients.map((c) => (
            <Link
              key={c.entityId}
              href={`/ec/${c.entityId}`}
              className="bg-card rounded-xl border border-border p-4 hover:border-primary transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{c.entityName}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.entryCount} ecritures
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {c.annotationCount > 0 && (
                  <span className="bg-amber-500/10 text-amber-600 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {c.annotationCount}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    c.exerciseStatus === "open"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.exerciseStatus === "open" ? "En cours" : "Cloture"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
