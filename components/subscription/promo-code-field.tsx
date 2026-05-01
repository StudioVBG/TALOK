"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, X, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PlanSlug } from "@/lib/subscriptions/plans";

interface ValidatedPromo {
  id: string;
  code: string;
  name: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  pricing: {
    original: number;
    discount: number;
    final: number;
  };
}

export interface PromoCodeFieldProps {
  planSlug: PlanSlug;
  billingCycle: "monthly" | "yearly";
  /** Called when a code is applied or cleared. Pass the raw code string
   *  (or null) — the backend will re-validate at checkout. */
  onChange?: (code: string | null, promo: ValidatedPromo | null) => void;
  className?: string;
}

function formatEUR(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

/**
 * Champ « Code promo » réutilisable. Appelle /api/subscriptions/promo/validate
 * au clic sur « Appliquer ». Affiche la remise si valide, l'erreur sinon.
 *
 * Note : la re-validation finale a lieu côté /api/subscriptions/checkout
 * (source de vérité). Ce composant sert à donner un feedback UI avant
 * la redirection Stripe.
 */
export function PromoCodeField({
  planSlug,
  billingCycle,
  onChange,
  className,
}: PromoCodeFieldProps) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<ValidatedPromo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const apply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmed,
          plan_slug: planSlug,
          billing_cycle: billingCycle,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setError(data.error || "Code promo invalide");
        setApplied(null);
        onChange?.(null, null);
        return;
      }
      const validated: ValidatedPromo = {
        ...data.code,
        pricing: data.pricing,
      };
      setApplied(validated);
      onChange?.(trimmed, validated);
    } catch {
      setError("Impossible de valider le code pour l'instant");
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setCode("");
    setApplied(null);
    setError(null);
    onChange?.(null, null);
  };

  if (applied) {
    return (
      <div
        className={`rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm ${className ?? ""}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-mono font-semibold">{applied.code}</span>
            <span>
              appliqué — remise {formatEUR(applied.pricing.discount)} (
              {applied.discount_type === "percent"
                ? `${applied.discount_value}%`
                : formatEUR(applied.discount_value)}
              )
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            aria-label="Retirer le code promo"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Total : <span className="line-through">{formatEUR(applied.pricing.original)}</span>{" "}
          <span className="font-semibold text-foreground">
            {formatEUR(applied.pricing.final)}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder="Code promo"
            className="pl-9 font-mono uppercase"
            maxLength={40}
            disabled={loading}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={apply}
          disabled={loading || !code.trim()}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Appliquer"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
