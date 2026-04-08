"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Building2 } from "lucide-react";
import { isPayable } from "@/lib/payments/invoice-state-machine";

interface PaymentButtonProps {
  invoiceId: string;
  invoiceStatus: string;
  amountCents: number;
  /** If true, uses SEPA via Stripe Connect (rent flow) */
  useConnect?: boolean;
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
  disabled?: boolean;
  onSuccess?: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
}

export function PaymentButton({
  invoiceId,
  invoiceStatus,
  amountCents,
  useConnect = true,
  stripeCustomerId,
  stripePaymentMethodId,
  disabled,
  onSuccess,
  onError,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  const canPay = isPayable(invoiceStatus) && amountCents > 0;
  const amountEur = (amountCents / 100).toFixed(2);

  async function handlePay() {
    if (!canPay || loading) return;

    setLoading(true);
    try {
      const endpoint = useConnect
        ? "/api/payments/create-rent-intent"
        : "/api/payments/create-intent";

      const body = useConnect
        ? {
            invoiceId,
            stripeCustomerId,
            stripePaymentMethodId,
          }
        : { invoiceId };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors du paiement");
      }

      onSuccess?.(data.paymentIntentId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du paiement";
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handlePay}
      disabled={!canPay || disabled || loading}
      className="w-full sm:w-auto"
      size="lg"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Paiement en cours...
        </>
      ) : (
        <>
          {useConnect ? (
            <Building2 className="mr-2 h-4 w-4" />
          ) : (
            <CreditCard className="mr-2 h-4 w-4" />
          )}
          Payer {amountEur} €
        </>
      )}
    </Button>
  );
}
