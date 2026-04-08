"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function CoproAppelsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("CoproAppels error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">
          Erreur de chargement
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Impossible de charger vos appels de fonds.
        </p>
        <Button onClick={reset} variant="outline">
          Reessayer
        </Button>
      </div>
    </div>
  );
}
