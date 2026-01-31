"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PropertiesError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to monitoring service in production
    console.error("[PropertiesError] Caught error:", error);
  }, [error]);

  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <Card className="border-red-200/50 shadow-lg">
          <CardHeader className="text-center pb-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center"
            >
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </motion.div>
            <CardTitle className="text-2xl text-slate-900">
              Une erreur est survenue
            </CardTitle>
            <CardDescription className="text-slate-600">
              Nous n'avons pas pu charger vos biens immobiliers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Details (dev only) */}
            {isDevelopment && error.message && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="p-4 rounded-lg bg-red-50 border border-red-200"
              >
                <div className="flex items-start gap-2">
                  <Bug className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1 overflow-hidden">
                    <p className="text-sm font-medium text-red-800">
                      Erreur technique
                    </p>
                    <p className="text-xs text-red-700 font-mono break-all">
                      {error.message}
                    </p>
                    {error.digest && (
                      <p className="text-xs text-red-600">
                        Digest: {error.digest}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Suggestions */}
            <div className="text-sm text-slate-600 space-y-2">
              <p>Cela peut arriver pour plusieurs raisons :</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                <li>Problème de connexion internet</li>
                <li>Le serveur est temporairement indisponible</li>
                <li>Votre session a peut-être expiré</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={reset}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Réessayer
              </Button>
              <Button
                variant="outline"
                asChild
                className="flex-1"
              >
                <Link href="/owner">
                  <Home className="mr-2 h-4 w-4" />
                  Tableau de bord
                </Link>
              </Button>
            </div>

            {/* Contact Support */}
            <p className="text-center text-xs text-slate-500">
              Si le problème persiste,{" "}
              <Link
                href="/support"
                className="text-blue-600 hover:underline"
              >
                contactez le support
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
