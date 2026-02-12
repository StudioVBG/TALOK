"use client";

import { useMutation } from "@tanstack/react-query";

export function useStripePortal() {
  return useMutation<{ url: string }, Error>({
    mutationFn: async () => {
      const res = await fetch("/api/billing/payment-method", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 && data.code === "NO_STRIPE_CUSTOMER") {
          throw new Error("Aucun moyen de paiement configuré. Souscrivez d'abord un forfait payant.");
        }
        throw new Error(data.error || "Impossible d'ouvrir le portail de paiement");
      }
      const data = await res.json();
      if (!data.url) {
        throw new Error("URL du portail de paiement non disponible");
      }
      return data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}
