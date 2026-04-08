"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  PenTool,
  ClipboardCheck,
  Euro,
  Key,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActivationConditions {
  bail_signe: boolean;
  edl_existe: boolean;
  edl_signe: boolean;
  paiement_initial_existe: boolean;
  paiement_initial_confirme: boolean;
  remise_cles_confirmee: boolean;
  date_debut_atteinte: boolean;
  toutes_signatures: boolean;
}

interface ActivationChecklistProps {
  leaseId: string;
  onActivate?: () => void;
  compact?: boolean;
}

const CHECKLIST_ITEMS = [
  {
    key: "bail_signe" as const,
    label: "Bail signé par toutes les parties",
    icon: PenTool,
    fallbackKey: "toutes_signatures" as const,
  },
  {
    key: "edl_signe" as const,
    label: "État des lieux d'entrée réalisé et signé",
    icon: ClipboardCheck,
    fallbackKey: "edl_existe" as const,
  },
  {
    key: "paiement_initial_confirme" as const,
    label: "Premier loyer et dépôt de garantie payés",
    icon: Euro,
    fallbackKey: "paiement_initial_existe" as const,
  },
  {
    key: "remise_cles_confirmee" as const,
    label: "Remise des clés confirmée",
    icon: Key,
    fallbackKey: null,
  },
];

export function ActivationChecklist({
  leaseId,
  onActivate,
  compact = false,
}: ActivationChecklistProps) {
  const [conditions, setConditions] = useState<ActivationConditions | null>(null);
  const [canActivate, setCanActivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConditions() {
      try {
        const res = await fetch(`/api/leases/${leaseId}/activate`);
        const data = await res.json();
        if (res.ok) {
          setConditions(data.conditions);
          setCanActivate(data.can_activate);
        } else {
          setError(data.error || "Erreur lors de la vérification");
        }
      } catch {
        setError("Impossible de vérifier les conditions d'activation");
      } finally {
        setLoading(false);
      }
    }
    fetchConditions();
  }, [leaseId]);

  async function handleActivate() {
    setActivating(true);
    setError(null);
    try {
      const res = await fetch(`/api/leases/${leaseId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip_date_check: true }),
      });
      const data = await res.json();
      if (res.ok) {
        onActivate?.();
      } else {
        setError(data.error || "Erreur lors de l'activation");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-none shadow-sm bg-card">
        <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Vérification des conditions…</span>
        </CardContent>
      </Card>
    );
  }

  const completedCount = conditions
    ? CHECKLIST_ITEMS.filter((item) => conditions[item.key]).length
    : 0;

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className={cn("pb-2 border-b border-border", compact && "p-3")}>
        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
          <span>Conditions d&apos;activation</span>
          <span className={cn(
            "text-xs font-semibold",
            canActivate ? "text-emerald-600" : "text-amber-600"
          )}>
            {completedCount}/{CHECKLIST_ITEMS.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("p-4 space-y-3", compact && "p-3 space-y-2")}>
        {CHECKLIST_ITEMS.map((item) => {
          const isCompleted = conditions?.[item.key] ?? false;
          const isPartial = !isCompleted && item.fallbackKey && conditions?.[item.fallbackKey];
          const Icon = item.icon;

          return (
            <div key={item.key} className="flex items-center gap-3">
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isPartial ? "text-amber-400" : "text-muted-foreground/40"
                )} />
              )}
              <Icon className={cn(
                "h-4 w-4 flex-shrink-0",
                isCompleted ? "text-emerald-600" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-sm",
                isCompleted ? "text-foreground" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </div>
          );
        })}

        {error && (
          <p className="text-xs text-destructive mt-2">{error}</p>
        )}

        {onActivate && (
          <Button
            onClick={handleActivate}
            disabled={!canActivate || activating}
            className="w-full mt-4"
            size={compact ? "sm" : "default"}
          >
            {activating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Activation en cours…
              </>
            ) : canActivate ? (
              "Activer le bail"
            ) : (
              "Conditions non remplies"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
