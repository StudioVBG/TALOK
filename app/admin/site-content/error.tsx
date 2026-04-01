"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function SiteContentError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <Card className="max-w-md mx-auto mt-12">
      <CardContent className="py-8 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
        <h2 className="text-lg font-semibold mb-2">Erreur de chargement</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Impossible de charger le contenu du site. La table site_content
          n&apos;existe peut-être pas encore.
        </p>
        <Button onClick={reset}>Réessayer</Button>
      </CardContent>
    </Card>
  );
}
