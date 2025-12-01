"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/monitoring";

/**
 * Page d'erreur globale Next.js App Router
 * Capture les erreurs non gérées au niveau de l'application
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logger l'erreur
    logger.error("Global error page triggered", {
      error,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-lg shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-full w-fit animate-bounce">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Oups ! Une erreur est survenue</CardTitle>
          <CardDescription className="text-base">
            Nous nous excusons pour ce désagrément. Notre équipe a été notifiée.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {process.env.NODE_ENV === "development" && (
            <details className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Détails de l&apos;erreur (dev only)
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

          <div className="text-sm text-muted-foreground text-center">
            <p>Cette erreur a été signalée automatiquement.</p>
            <p>Vous pouvez réessayer ou retourner à l&apos;accueil.</p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
            className="w-full sm:w-auto"
          >
            <Home className="h-4 w-4 mr-2" />
            Accueil
          </Button>
          <Button onClick={reset} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
