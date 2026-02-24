"use client";

/**
 * Redirection SOTA 2026 : la gestion des coordonnées bancaires et des moyens de paiement
 * propriétaire a été déplacée vers /owner/settings/payments (onglet Compte bancaire).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { Loader2 } from "lucide-react";

export default function OwnerBankingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/owner/settings/payments?tab=bank");
  }, [router]);

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-muted-foreground">Redirection vers Moyens de paiement...</p>
      </div>
    </ProtectedRoute>
  );
}
