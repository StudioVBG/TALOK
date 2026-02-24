"use client";

import { CreditCard, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStripePortal } from "@/hooks/useStripePortal";
import { isExpiringSoon } from "@/lib/billing-utils";
import type { BillingPaymentMethod as PaymentMethodType } from "@/types/billing";
import Link from "next/link";

const BRAND_DISPLAY: Record<string, { label: string }> = {
  visa: { label: "Visa" },
  mastercard: { label: "Mastercard" },
  amex: { label: "Amex" },
  discover: { label: "Discover" },
  unknown: { label: "Carte" },
};

interface PaymentMethodProps {
  paymentMethod: PaymentMethodType | null;
  /** Quand défini, les boutons "Ajouter" / "Modifier" redirigent vers cette URL au lieu d'ouvrir le portail Stripe (ex: /owner/settings/payments). */
  manageUrl?: string;
}

export function PaymentMethod({ paymentMethod, manageUrl }: PaymentMethodProps) {
  const { mutate: openPortal, isPending } = useStripePortal();

  const actionButton = (label: string, icon: React.ReactNode) => {
    if (manageUrl) {
      return (
        <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:text-white flex-shrink-0" asChild>
          <Link href={manageUrl}>{icon}{icon ? " " : ""}{label}</Link>
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        className={label === "Ajouter" ? "bg-red-600 hover:bg-red-500 flex-shrink-0" : "border-slate-600 text-slate-300 hover:text-white flex-shrink-0"}
        variant={label === "Ajouter" ? "default" : "outline"}
        onClick={() => openPortal()}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" /> : icon}
        {(isPending || icon) && <span className="ml-1.5" />}
        {label}
      </Button>
    );
  };

  if (!paymentMethod) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-300">Aucun moyen de paiement</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Ajoutez une carte bancaire pour maintenir votre abonnement actif.
            </p>
          </div>
          {actionButton("Ajouter", <CreditCard className="w-4 h-4" aria-hidden="true" />)}
        </div>
      </div>
    );
  }

  const brand = BRAND_DISPLAY[paymentMethod.brand] || BRAND_DISPLAY.unknown;
  const expiring7 = isExpiringSoon(paymentMethod.exp_month, paymentMethod.exp_year, 7);
  const expiring30 = isExpiringSoon(paymentMethod.exp_month, paymentMethod.exp_year, 30);

  return (
    <div
      className={cn(
        "p-4 rounded-lg border",
        expiring7
          ? "bg-red-500/10 border-red-500/30"
          : expiring30
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-slate-900/50 border-slate-700/50"
      )}
    >
      <div className="flex items-center gap-3">
        <CreditCard
          className={cn(
            "w-5 h-5 flex-shrink-0",
            expiring7 ? "text-red-400" : expiring30 ? "text-amber-400" : "text-slate-400"
          )}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-200">
            {brand.label} **** **** **** {paymentMethod.last4}
          </p>
          <p className={cn(
            "text-xs mt-0.5",
            expiring7 ? "text-red-400 font-medium" : expiring30 ? "text-amber-400" : "text-slate-400"
          )}>
            exp. {String(paymentMethod.exp_month).padStart(2, "0")}/{paymentMethod.exp_year}
            {expiring7 && " — Expire dans moins de 7 jours !"}
            {!expiring7 && expiring30 && " — Expire bientot"}
          </p>
        </div>
        {actionButton("Modifier", null)}
      </div>
    </div>
  );
}
