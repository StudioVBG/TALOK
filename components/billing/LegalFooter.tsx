"use client";

import { DatabaseBackup, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { useState } from "react";

export function LegalFooter() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/billing/export");
      if (!res.ok) throw new Error("Erreur lors de l'export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `talok-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Export reussi",
        description: "Vos donnees ont ete telechargees.",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter vos donnees pour le moment.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="bg-slate-800/30 border-slate-700/50">
      <CardContent className="py-4 px-5">
        <h2 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
          Informations legales
        </h2>
        <div className="text-xs text-slate-500 space-y-2">
          <p>
            Droit de retractation de 14 jours (Art. L221-18 du Code de la Consommation).
            Toute modification tarifaire sera notifiee 30 jours a l&apos;avance (Art. L215-1).
          </p>
          <p>
            TVA appliquee selon votre territoire : Metropole 20% | Martinique/Guadeloupe/Reunion 8,5% | Guyane 0% | Mayotte 8,5%.
          </p>
          <p>
            Les factures sont conformes aux mentions obligatoires du CGI Art. 289
            (numerotation sequentielle, mentions vendeur/acheteur, taux de TVA, montants HT/TTC).
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
            <Link href="/legal/cgv" className="underline hover:text-slate-300 transition-colors">CGV</Link>
            <Link href="/legal/cgu" className="underline hover:text-slate-300 transition-colors">CGU</Link>
            <Link href="/legal/privacy" className="underline hover:text-slate-300 transition-colors">
              Politique de confidentialite
            </Link>
            <Link href="/legal/cookies" className="underline hover:text-slate-300 transition-colors">Cookies</Link>
            <Link href="/legal/mentions" className="underline hover:text-slate-300 transition-colors">
              Mentions legales
            </Link>
            <span className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-slate-700 text-slate-400 hover:text-white"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <DatabaseBackup className="w-3 h-3 mr-1" aria-hidden="true" />
              )}
              Exporter mes donnees (Art. 20 RGPD)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
