"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "info" | "success" | "warning" | "critical";

interface Broadcast {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  cta_label: string | null;
  cta_url: string | null;
  dismissible: boolean;
}

const SEVERITY_STYLES: Record<Severity, { className: string; Icon: React.ComponentType<{ className?: string }> }> = {
  info: {
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    Icon: Info,
  },
  success: {
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    Icon: CheckCircle2,
  },
  warning: {
    className: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
    Icon: AlertCircle,
  },
  critical: {
    className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
    Icon: AlertTriangle,
  },
};

/**
 * Bandeau plateforme — affiche les broadcasts actifs pour l'utilisateur courant.
 *
 * À placer dans un layout authentifié (owner, tenant, admin, etc.).
 * Ne rend rien si aucun broadcast actif ou si tous dismissés.
 */
export function PlatformBroadcastBanner() {
  const qc = useQueryClient();
  const [dismissing, setDismissing] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["broadcasts", "active"],
    queryFn: async () => {
      const res = await fetch("/api/broadcasts/active");
      if (!res.ok) return { broadcasts: [] };
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const broadcasts: Broadcast[] = data?.broadcasts || [];

  const dismiss = async (id: string) => {
    setDismissing(id);
    try {
      await fetch(`/api/broadcasts/${id}/dismiss`, { method: "POST" });
      qc.setQueryData(["broadcasts", "active"], (prev: { broadcasts: Broadcast[] } | undefined) => ({
        broadcasts: (prev?.broadcasts || []).filter((b) => b.id !== id),
      }));
    } finally {
      setDismissing(null);
    }
  };

  if (broadcasts.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-3" role="region" aria-label="Annonces plateforme">
      {broadcasts.map((b) => {
        const style = SEVERITY_STYLES[b.severity] || SEVERITY_STYLES.info;
        const { Icon } = style;
        const isExternal = b.cta_url ? /^https?:\/\//.test(b.cta_url) : false;
        return (
          <div
            key={b.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
              style.className
            )}
            role={b.severity === "critical" ? "alert" : "status"}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{b.title}</p>
              <p className="mt-0.5 whitespace-pre-wrap opacity-90">{b.body}</p>
              {b.cta_url && (
                <div className="mt-2">
                  {isExternal ? (
                    <a
                      href={b.cta_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      {b.cta_label || "En savoir plus"}
                    </a>
                  ) : (
                    <Link href={b.cta_url} className="underline font-medium">
                      {b.cta_label || "En savoir plus"}
                    </Link>
                  )}
                </div>
              )}
            </div>
            {b.dismissible && (
              <button
                type="button"
                onClick={() => dismiss(b.id)}
                disabled={dismissing === b.id}
                className="shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
                aria-label="Fermer l'annonce"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
