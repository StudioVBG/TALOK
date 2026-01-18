"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  Download,
  Printer,
  Maximize2,
  AlertTriangle,
  X,
  RefreshCw,
  Check,
  FileText,
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import type { EDLComplet } from "@/lib/templates/edl/types";

interface EDLPreviewProps {
  edlData: Partial<EDLComplet>;
  edlId?: string;
  onGenerated?: (result: { url: string; path: string }) => void;
  isVierge?: boolean; // Pour le mode "template vierge" (pack Gratuit/Starter)
  rooms?: string[]; // Liste des pièces pour le template vierge
}

/**
 * Composant de prévisualisation d'état des lieux
 * 
 * PATTERN: Création unique → Lectures multiples
 * - Debounce de 500ms pour éviter les régénérations pendant la saisie
 * - Mémorisation du hash des données pour éviter les re-renders inutiles
 * - Cache du HTML généré côté client
 */
export function EDLPreview({
  edlData,
  edlId,
  onGenerated,
  isVierge = false,
  rooms = ["Entrée", "Salon / Séjour", "Cuisine", "Chambre 1", "Salle de bain", "WC"],
}: EDLPreviewProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHashRef = useRef<string>("");
  const { toast } = useToast();

  // === MÉMORISATION: Hash des données clés pour éviter re-renders inutiles ===
  const dataHash = useMemo(() => {
    const hashData = JSON.stringify({
      type: edlData.type,
      logement_adresse: edlData.logement?.adresse_complete,
      logement_ville: edlData.logement?.ville,
      bailleur_nom: edlData.bailleur?.nom_complet,
      locataires: edlData.locataires?.map((l) => l.nom_complet),
      nb_pieces: edlData.pieces?.length,
      // 🔧 FIX: Inclure les valeurs des relevés de compteurs pour forcer la regénération
      compteurs: edlData.compteurs?.map((c) => ({
        type: c.type,
        meter_number: c.meter_number,
        reading: c.reading,
        unit: c.unit,
      })),
      scheduled_date: edlData.scheduled_date,
      isVierge,
      rooms: isVierge ? rooms : undefined,
      // 🔧 FIX: Inclure les signatures pour forcer la regénération après une signature
      signatures: edlData.signatures?.map((s) => ({
        type: s.signer_type,
        signed: !!s.signed_at,
        hasImage: !!s.signature_image,
      })),
    });

    let hash = 0;
    for (let i = 0; i < hashData.length; i++) {
      const char = hashData.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }, [edlData, isVierge, rooms]);

  // Valider les données de l'EDL
  const validateEDLData = useCallback((): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // En mode vierge (template imprimable), on n'affiche que des recommandations
    if (isVierge) {
      if (!edlData.logement?.adresse_complete) {
        warnings.push("Adresse du logement manquante");
      }
      if (!edlData.bailleur?.nom_complet && !edlData.bailleur?.raison_sociale) {
        warnings.push("Nom du bailleur manquant");
      }
      if (!edlData.locataires || edlData.locataires.length === 0) {
        warnings.push("Aucun locataire défini");
      }
      // En mode vierge, ces avertissements sont informatifs seulement
      return { errors: [], warnings };
    }

    // Mode numérique (EDL complet)
    if (!edlData.logement?.adresse_complete) {
      errors.push("Adresse du logement manquante");
    }

    if (!edlData.bailleur?.nom_complet && !edlData.bailleur?.raison_sociale) {
      errors.push("Nom du bailleur manquant");
    }

    if (!edlData.locataires || edlData.locataires.length === 0) {
      errors.push("Aucun locataire défini");
    }

    if (!edlData.pieces || edlData.pieces.length === 0) {
      errors.push("Aucune pièce inspectée");
    }

    if (!edlData.compteurs || edlData.compteurs.length === 0) {
      warnings.push("Aucun compteur enregistré pour ce logement");
    } else {
      const unreadMeters = edlData.compteurs.filter(c => c.reading === "Non relevé" || !c.reading);
      if (unreadMeters.length > 0) {
        warnings.push(`${unreadMeters.length} relevé(s) de compteur à saisir`);
      }
    }

    // Vérifier que toutes les pièces ont des items évalués
    edlData.pieces?.forEach((piece) => {
      const unevaluated = piece.items.filter((item) => !item.condition);
      if (unevaluated.length > 0) {
        warnings.push(`${unevaluated.length} élément(s) non évalué(s) dans "${piece.nom}"`);
      }
    });

    if (!edlData.cles_remises || edlData.cles_remises.length === 0) {
      warnings.push("Aucune clé enregistrée");
    }

    return { errors, warnings };
  }, [edlData, isVierge]);

  // Calculer les statistiques de l'EDL
  const stats = useMemo(() => {
    if (isVierge || !edlData.pieces) {
      return null;
    }

    let nbNeuf = 0, nbBon = 0, nbMoyen = 0, nbMauvais = 0, nbTresMauvais = 0, nbTotal = 0;

    edlData.pieces.forEach((piece) => {
      piece.items.forEach((item) => {
        if (item.condition) {
          nbTotal++;
          if (item.condition === "neuf") nbNeuf++;
          else if (item.condition === "bon") nbBon++;
          else if (item.condition === "moyen") nbMoyen++;
          else if (item.condition === "mauvais") nbMauvais++;
          else if (item.condition === "tres_mauvais") nbTresMauvais++;
        }
      });
    });

    // Neuf + Bon sont considérés comme "bon état" pour le pourcentage global
    const pourcentageBon = nbTotal > 0 ? Math.round(((nbNeuf + nbBon) / nbTotal) * 100) : 0;

    return {
      nbNeuf,
      nbBon,
      nbMoyen,
      nbMauvais,
      nbTresMauvais,
      nbTotal,
      pourcentageBon,
    };
  }, [edlData.pieces, isVierge]);

  // === DEBOUNCE: Génération de l'aperçu avec délai ===
  useEffect(() => {
    if (lastHashRef.current === dataHash && html) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const { errors, warnings } = validateEDLData();
        setValidationErrors(errors);
        setValidationWarnings(warnings);

        if (errors.length > 0 && !isVierge) {
          setHtml("");
          setLoading(false);
          return;
        }

        const response = await fetch("/api/edl/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            edlData,
            edlId,
            isVierge,
            rooms: isVierge ? rooms : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error("Erreur lors de la génération de l'aperçu");
        }

        const { html: generatedHtml } = await response.json();
        setHtml(generatedHtml);
        lastHashRef.current = dataHash;
        setLastGenerated(new Date());
      } catch (error) {
        console.error("Erreur génération EDL:", error);
        toast({
          title: "Erreur",
          description: "Impossible de générer l'aperçu de l'état des lieux",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [dataHash, edlData, edlId, isVierge, rooms, validateEDLData, toast, html]);

  // Mettre à jour l'iframe quand le HTML change
  useEffect(() => {
    if (iframeRef.current && html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [html]);

  // Télécharger le PDF
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const response = await fetch("/api/edl/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edlData,
          edlId,
          isVierge,
          rooms: isVierge ? rooms : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la génération du PDF");
      }

      const { html: pdfHtml, fileName } = await response.json();
      
      // Utiliser html2pdf.js côté client
      const html2pdf = (await import("html2pdf.js")).default;
      
      const opt = {
        margin: 10,
        filename: fileName || `edl_${edlData.type || "document"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // Créer un élément temporaire pour le rendu
      const element = document.createElement("div");
      element.innerHTML = pdfHtml;
      document.body.appendChild(element);

      await html2pdf().set(opt).from(element).save();
      
      document.body.removeChild(element);

      toast({
        title: "PDF téléchargé",
        description: "L'état des lieux a été téléchargé avec succès",
      });
    } catch (error) {
      console.error("Erreur téléchargement:", error);
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le PDF",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  }, [edlData, edlId, isVierge, rooms, toast]);

  // Imprimer
  const handlePrint = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  }, []);

  // Forcer la régénération
  const handleRefresh = useCallback(() => {
    lastHashRef.current = "";
    setLoading(true);
    // Le useEffect va se déclencher automatiquement
  }, []);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              {isVierge ? "Template EDL à imprimer" : "Aperçu de l'état des lieux"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              disabled={!html || loading}
              className="h-8 w-8 p-0"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={!html || downloading || loading}
              className="h-8 w-8 p-0"
            >
              {downloading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            <Dialog open={fullscreen} onOpenChange={setFullscreen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={!html}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
                <DialogHeader className="p-4 border-b">
                  <DialogTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    État des lieux {edlData.type === "sortie" ? "de sortie" : "d'entrée"}
                  </DialogTitle>
                </DialogHeader>
                <div className="h-[80vh] overflow-hidden">
                  <iframe
                    srcDoc={html}
                    className="w-full h-full border-0"
                    title="Aperçu EDL plein écran"
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Badge type EDL */}
        <div className="flex items-center gap-2 mt-2">
          <Badge variant={edlData.type === "sortie" ? "destructive" : "default"}>
            EDL {edlData.type === "sortie" ? "de sortie" : "d'entrée"}
          </Badge>
          {isVierge && (
            <Badge variant="secondary">Template vierge</Badge>
          )}
          {lastGenerated && (
            <span className="text-xs text-muted-foreground">
              Généré à {lastGenerated.toLocaleTimeString("fr-FR")}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Statistiques si EDL numérique */}
        {stats && !isVierge && (
          <div className="grid grid-cols-4 gap-2 p-3 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{stats.nbBon}</div>
              <div className="text-xs text-muted-foreground">Bon</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">{stats.nbMoyen}</div>
              <div className="text-xs text-muted-foreground">Moyen</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">{stats.nbMauvais}</div>
              <div className="text-xs text-muted-foreground">Mauvais</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">{stats.nbTresMauvais}</div>
              <div className="text-xs text-muted-foreground">Très mauvais</div>
            </div>
          </div>
        )}

        {stats && !isVierge && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>État général</span>
              <span className="font-medium">{stats.pourcentageBon}% en bon état</span>
            </div>
            <Progress value={stats.pourcentageBon} className="h-2" />
          </div>
        )}

        {/* Erreurs de validation */}
        <AnimatePresence>
          {validationErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-red-800 text-sm">
                    Données manquantes ({validationErrors.length})
                  </p>
                  <ul className="text-sm text-red-600 space-y-0.5">
                    {validationErrors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Avertissements */}
        <AnimatePresence>
          {validationWarnings.length > 0 && validationErrors.length === 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 bg-amber-50 border border-amber-200 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-800 text-sm">
                    Recommandations ({validationWarnings.length})
                  </p>
                  <ul className="text-sm text-amber-600 space-y-0.5">
                    {validationWarnings.slice(0, 3).map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                    {validationWarnings.length > 3 && (
                      <li className="text-amber-500">
                        ...et {validationWarnings.length - 3} autre(s)
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Aperçu iframe - Responsive */}
        <div className="relative bg-white border rounded-lg overflow-hidden shadow-inner min-h-[300px] sm:min-h-[400px]">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 px-4">
              <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary mb-3" />
              <p className="text-xs sm:text-sm text-muted-foreground text-center">Génération de l'aperçu...</p>
            </div>
          ) : validationErrors.length > 0 && !isVierge ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 px-4">
              <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/50 mb-3" />
              <p className="text-xs sm:text-sm text-muted-foreground text-center">
                Complétez les informations requises pour voir l'aperçu
              </p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              className="w-full h-[50vh] sm:h-[60vh] md:h-[500px] border-0"
              title="Aperçu de l'état des lieux"
            />
          )}
        </div>

        {/* Actions - ✅ Nettoyage: Bouton masqué car déjà présent dans le header de l'aperçu */}
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {isVierge
              ? "Téléchargez ce template à imprimer et remplir sur place"
              : "L'aperçu se met à jour automatiquement"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default EDLPreview;

