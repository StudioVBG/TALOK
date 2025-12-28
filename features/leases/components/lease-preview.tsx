"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Printer,
  Maximize2,
  AlertTriangle,
  X,
  RefreshCw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { pdfService } from "@/lib/services/pdf.service";
import type { BailComplet, TypeBail } from "@/lib/templates/bail/types";

interface LeasePreviewProps {
  typeBail: TypeBail;
  bailData: Partial<BailComplet>;
  leaseId?: string;
  draftId?: string;
  onGenerated?: (result: { url: string; path: string }) => void;
}

const typeLabels: Record<TypeBail, string> = {
  nu: "Location vide",
  meuble: "Location meublée",
  colocation: "Colocation",
  saisonnier: "Location saisonnière",
  mobilite: "Bail mobilité",
};

/**
 * Composant de prévisualisation de bail avec optimisation
 * 
 * PATTERN: Création unique → Lectures multiples
 * - Debounce de 500ms pour éviter les régénérations pendant la saisie
 * - Mémorisation du hash des données pour éviter les re-renders inutiles
 * - Cache du HTML généré côté client
 */
export function LeasePreview({
  typeBail,
  bailData,
  leaseId,
  draftId,
  onGenerated,
}: LeasePreviewProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHashRef = useRef<string>("");
  const { toast } = useToast();

  // === MÉMORISATION: Hash des données clés pour éviter re-renders inutiles ===
  const dataHash = useMemo(() => {
    // Créer un hash stable basé sur les données importantes uniquement
    const hashData = JSON.stringify({
      typeBail,
      bailleur_nom: bailData.bailleur?.nom,
      bailleur_prenom: bailData.bailleur?.prenom,
      bailleur_adresse: bailData.bailleur?.adresse,
      locataires: bailData.locataires?.map(l => ({
        nom: l.nom,
        prenom: l.prenom,
      })),
      logement_adresse: bailData.logement?.adresse_complete,
      logement_surface: bailData.logement?.surface_habitable,
      logement_pieces: bailData.logement?.nb_pieces_principales,
      loyer: bailData.conditions?.loyer_hc,
      charges: bailData.conditions?.charges_montant,
      depot: bailData.conditions?.depot_garantie,
      date_debut: bailData.conditions?.date_debut,
      date_fin: bailData.conditions?.date_fin,
      dpe_classe: bailData.diagnostics?.dpe?.classe_energie,
    });
    
    // Simple hash pour comparaison
    let hash = 0;
    for (let i = 0; i < hashData.length; i++) {
      const char = hashData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }, [typeBail, bailData]);

  // Valider les données du bail
  const validateBailData = useCallback((): string[] => {
    const errors: string[] = [];
    
    if (!bailData.bailleur?.nom || !bailData.bailleur?.prenom) {
      errors.push("Informations du bailleur incomplètes");
    }
    
    if (!bailData.locataires || bailData.locataires.length === 0) {
      errors.push("Aucun locataire défini");
    }
    
    if (!bailData.logement?.adresse_complete) {
      errors.push("Adresse du logement manquante");
    }
    
    if (!bailData.logement?.surface_habitable) {
      errors.push("Surface habitable non renseignée");
    }
    
    if (!bailData.conditions?.loyer_hc) {
      errors.push("Montant du loyer non renseigné");
    }
    
    if (!bailData.conditions?.date_debut) {
      errors.push("Date de début du bail non renseignée");
    }
    
    if (!bailData.diagnostics?.dpe) {
      errors.push("DPE non renseigné (obligatoire)");
    }
    
    return errors;
  }, [bailData]);

  // === DEBOUNCE: Génération de l'aperçu avec délai ===
  useEffect(() => {
    // Si le hash n'a pas changé, ne pas régénérer
    if (lastHashRef.current === dataHash && html) {
      return;
    }

    // Annuler le timer précédent
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Marquer comme en chargement
    setLoading(true);

    // Debounce de 500ms - attend que l'utilisateur arrête de taper
    debounceTimerRef.current = setTimeout(async () => {
      const errors = validateBailData();
      setValidationErrors(errors);

      try {
        const previewHtml = pdfService.previewLease(typeBail, bailData);
        setHtml(previewHtml);
        lastHashRef.current = dataHash;
        setLastGenerated(new Date());
      } catch (error: unknown) {
        console.error("Erreur génération prévisualisation:", error);
        toast({
          title: "Erreur",
          description: "Impossible de générer la prévisualisation",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms de debounce

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [dataHash, typeBail, bailData, validateBailData, toast, html]);

  // === TÉLÉCHARGEMENT: Utiliser l'impression native pour garantir le rendu ===
  const handleDownloadPDF = async () => {
    const errors = validateBailData();
    
    if (errors.length > 0) {
      toast({
        title: "⚠️ Données incomplètes",
        description: `${errors.length} champ(s) manquant(s). Le document peut être incomplet.`,
      });
    }

    // Méthode la plus fiable : utiliser l'impression native de l'iframe
    if (iframeRef.current?.contentWindow) {
            toast({
        title: "🖨️ Impression PDF",
        description: "Choisissez 'Enregistrer au format PDF' dans la fenêtre d'impression.",
      });
      iframeRef.current.contentWindow.print();
    } else {
      toast({
        title: "Erreur",
        description: "Impossible d'accéder au document pour l'impression.",
        variant: "destructive",
      });
    }
  };

  // Imprimer le bail
  const handlePrint = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  }, []);

  // Forcer la régénération
  const handleRefresh = useCallback(() => {
    lastHashRef.current = ""; // Reset hash pour forcer régénération
    setLoading(true);
    
    try {
      const previewHtml = pdfService.previewLease(typeBail, bailData);
      setHtml(previewHtml);
      lastHashRef.current = dataHash;
      setLastGenerated(new Date());
      toast({
        title: "Aperçu actualisé",
        description: "La prévisualisation a été regénérée",
      });
    } catch (error) {
      console.error("Erreur régénération:", error);
    } finally {
      setLoading(false);
    }
  }, [typeBail, bailData, dataHash, toast]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Bail {typeLabels[typeBail]}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                Aperçu en temps réel du contrat
                {lastGenerated && (
                  <span className="text-[10px] text-muted-foreground/60">
                    (màj {lastGenerated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Bouton Actualiser */}
            <Button 
              onClick={handleRefresh} 
              variant="ghost" 
              size="sm"
              disabled={loading}
              title="Forcer l'actualisation"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Imprimer</span>
            </Button>
            
            <Dialog open={fullscreen} onOpenChange={setFullscreen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Maximize2 className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Plein écran</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] h-[95vh] p-0 flex flex-col">
                <DialogHeader className="p-4 border-b shrink-0">
                  <div className="flex items-center justify-between">
                    <DialogTitle>
                      Bail {typeLabels[typeBail]}
                    </DialogTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFullscreen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </DialogHeader>
                <div className="flex-1 min-h-0">
                  <iframe
                    srcDoc={html}
                    className="w-full h-full border-0"
                    title="Prévisualisation du bail (plein écran)"
                  />
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={handleDownloadPDF}
              disabled={downloading}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 ml-2"
            >
              {downloading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Télécharger PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
        {/* Erreurs de validation */}
        <AnimatePresence>
          {validationErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-lg p-3 shrink-0"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800 text-sm">
                    Données manquantes ({validationErrors.length})
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                    {validationErrors.slice(0, 3).map((error, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-amber-500 rounded-full" />
                        {error}
                      </li>
                    ))}
                    {validationErrors.length > 3 && (
                      <li className="text-amber-600 italic">
                        + {validationErrors.length - 3} autres...
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Indicateur de statut de cache */}
        {!loading && lastGenerated && validationErrors.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-green-600 shrink-0">
            <Check className="h-3 w-3" />
            <span>Aperçu à jour</span>
          </div>
        )}

        {/* Zone de prévisualisation */}
        <div className="flex-1 border rounded-lg overflow-hidden bg-slate-50 relative min-h-[500px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
               <div className="flex flex-col items-center gap-3">
                 <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                 <p className="text-sm text-slate-500 font-medium">Génération de l'aperçu...</p>
                 <p className="text-xs text-slate-400">Mise à jour automatique après saisie</p>
               </div>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              className="w-full h-full border-0 bg-white"
              title="Prévisualisation du bail"
            />
          )}
        </div>

        {/* Info légale */}
        <div className="text-[10px] text-muted-foreground text-center shrink-0">
          Ce document est conforme à la loi ALUR et aux décrets en vigueur.
        </div>
      </CardContent>
    </Card>
  );
}

export default LeasePreview;
