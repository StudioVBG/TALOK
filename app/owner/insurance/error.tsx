"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OwnerInsuranceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h2 className="text-lg font-semibold mb-2">Erreur de chargement</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Impossible de charger vos assurances. Veuillez reessayer.
      </p>
      <Button onClick={reset}>Reessayer</Button>
    </div>
  );
}
