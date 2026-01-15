"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/monitoring";

/**
 * Page d'erreur pour le tableau de bord Admin
 * Capture les erreurs non gerees dans la section admin
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Admin dashboard error", {
      error,
      digest: error.digest,
      section: "admin",
    });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-full w-fit">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl">Erreur dans le panneau Admin</CardTitle>
          <CardDescription>
            Une erreur inattendue s&apos;est produite. Notre equipe technique a ete notifiee.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {process.env.NODE_ENV === "development" && (
            <details className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Details de l&apos;erreur (dev uniquement)
              </summary>
              <pre className="mt-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
                {error.message}
              </pre>
              {error.digest && (
                <p className="mt-2 text-xs text-muted-foreground">
                  ID: {error.digest}
                </p>
              )}
            </details>
          )}

          <p className="text-sm text-muted-foreground text-center">
            Vous pouvez reessayer ou retourner au tableau de bord.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/admin/dashboard")}
            className="w-full sm:w-auto"
          >
            <Home className="h-4 w-4 mr-2" />
            Tableau de bord
          </Button>
          <Button onClick={reset} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reessayer
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
