"use client";

import { useState } from "react";
import { Download, Loader2, FileJson, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

interface DataExportButtonProps {
  lastExportDate?: string | null;
}

export function DataExportButton({ lastExportDate }: DataExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rgpd/export", { method: "POST" });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'export");
      }

      // Download the JSON file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `talok-export-rgpd-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExported(true);
      toast({
        title: "Export termine",
        description: "Vos donnees ont ete telechargees au format JSON.",
      });
    } catch (err: any) {
      toast({
        title: "Erreur d'export",
        description: err.message || "Impossible d'exporter vos donnees. Reessayez.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <FileJson className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Exporter mes donnees</CardTitle>
            <CardDescription>
              Droit a la portabilite (Article 20 RGPD) — Telechargez toutes vos donnees au format
              JSON
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          L&apos;export contient votre profil, consentements, biens, baux, factures, paiements,
          documents, tickets et notifications.
        </p>
        {lastExportDate && (
          <p className="text-xs text-muted-foreground">
            Dernier export : {new Date(lastExportDate).toLocaleDateString("fr-FR")}
          </p>
        )}
        <Button
          onClick={handleExport}
          disabled={loading}
          variant={exported ? "outline" : "default"}
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Export en cours...
            </>
          ) : exported ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Exporte — Re-telecharger
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Telecharger mes donnees
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
