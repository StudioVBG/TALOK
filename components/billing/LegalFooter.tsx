"use client";

import { useState } from "react";
import { ChevronDown, DatabaseBackup, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function LegalFooter() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
      <CardContent className="py-3 px-5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={expanded}
          aria-controls="legal-content"
        >
          <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Informations legales
          </h2>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-400 transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              id="legal-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="text-xs text-slate-400 space-y-2 pt-3">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3">
          <Link href="/legal/cgv" className="text-xs text-slate-400 underline hover:text-slate-200 transition-colors">CGV</Link>
          <Link href="/legal/cgu" className="text-xs text-slate-400 underline hover:text-slate-200 transition-colors">CGU</Link>
          <Link href="/legal/privacy" className="text-xs text-slate-400 underline hover:text-slate-200 transition-colors">
            Politique de confidentialite
          </Link>
          <Link href="/legal/cookies" className="text-xs text-slate-400 underline hover:text-slate-200 transition-colors">Cookies</Link>
          <Link href="/legal/mentions" className="text-xs text-slate-400 underline hover:text-slate-200 transition-colors">
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
            <span className="hidden sm:inline">Exporter mes donnees (Art. 20 RGPD)</span>
            <span className="sm:hidden">Exporter (RGPD)</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
