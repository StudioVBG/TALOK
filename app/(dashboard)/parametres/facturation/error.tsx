"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FacturationError({ error, reset }: ErrorProps) {
  const { toast } = useToast();

  useEffect(() => {
    toast({
      title: "Erreur de chargement",
      description: error.message || "Impossible de charger la page de facturation.",
      variant: "destructive",
    });
  }, [error, toast]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertTriangle className="w-12 h-12 text-red-400 mb-4" aria-hidden="true" />
      <h2 className="text-xl font-bold text-white mb-2">
        Erreur de chargement
      </h2>
      <p className="text-slate-400 mb-6 max-w-md">
        Impossible de charger vos informations de facturation.
        Veuillez reessayer ou contacter le support si le probleme persiste.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>
          <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
          Reessayer
        </Button>
        <Button variant="outline" className="border-slate-700 text-slate-400" asChild>
          <a href="mailto:support@talok.fr">Contacter le support</a>
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-slate-600 mt-4">
          Ref. erreur : {error.digest}
        </p>
      )}
    </div>
  );
}
