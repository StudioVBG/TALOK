"use client";

import { useMutation } from "@tanstack/react-query";

export function useStripePortal() {
  return useMutation<{ url: string }, Error>({
    mutationFn: async () => {
      const res = await fetch("/api/billing/payment-method", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Impossible d'ouvrir le portail de paiement");
      }
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}
