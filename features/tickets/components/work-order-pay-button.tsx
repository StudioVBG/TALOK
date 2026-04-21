"use client";

import { useState } from "react";
import { CreditCard, Loader2, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  workOrderId: string;
  /** Affiché pour info, pas utilisé côté API (le backend calcule). */
  hintLabel?: string;
  /** full / deposit / balance — par défaut 'full' */
  paymentType?: "deposit" | "balance" | "full";
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline";
}

/**
 * Bouton "Payer par carte" — crée une Stripe Checkout Session côté serveur
 * et redirige l'utilisateur vers la page Stripe hébergée. Le webhook prend
 * le relais à la confirmation pour marquer le paiement succeeded et avancer
 * le work_order.
 */
export function WorkOrderPayButton({
  workOrderId,
  hintLabel,
  paymentType = "full",
  size = "default",
  variant = "default",
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/work-orders/${workOrderId}/checkout-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_type: paymentType }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Impossible de préparer le paiement");
      }
      // Redirection vers Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de préparer le paiement",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePay}
      disabled={loading}
      size={size}
      variant={variant}
      className={
        variant === "default"
          ? "bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          : undefined
      }
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          {hintLabel || "Payer par carte"}
          <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
        </>
      )}
    </Button>
  );
}
