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
  /** HTML pré-généré côté client — si fourni, aucun appel API ne sera effectué */
  previewHtml?: string;
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
  previewHtml,
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

  // Refs pour accéder aux dernières valeurs sans retrigger l'effet de debounce.
  // Sans ces refs, chaque nouveau `edlData` reçu du parent (nouvelle référence à
  // chaque render) relance le timer et la page reste bloquée sur "Génération…".
  const edlDataRef = useRef(edlData);
  const roomsRef = useRef(rooms);
  const toastRef = useRef(toast);
  const htmlRef = useRef(html);
  useEffect(() => {
    edlDataRef.current = edlData;
    roomsRef.current = rooms;
    toastRef.current = toast;
    htmlRef.current = html;
  });

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
      // Normaliser la valeur: supporte 'reading' (string) et 'reading_value' (number)
      compteurs: edlData.compteurs?.map((c: any) => ({
        type: c.type,
        meter_number: c.meter_number,
        // Normaliser: utiliser reading_value si disponible, sinon reading
        reading_value: c.reading_value !== undefined ? String(c.reading_value) : c.reading,
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
      // 🔧 FIX: Vérifier les deux formats possibles (reading et reading_value)
      const unreadMeters = edlData.compteurs.filter((c: any) => {
        const readingVal = c.reading_value !== undefined ? String(c.reading_value) : c.reading;
        return readingVal === "Non relevé" || readingVal === "null" || !readingVal;
      });
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

  // === MODE PREVIEW HTML PRÉ-GÉNÉRÉ (sans appel API) ===
  useEffect(() => {
    if (previewHtml === undefined) return;
    setHtml(previewHtml);
    setLoading(false);
    setLastGenerated(new Date());

    const { errors, warnings } = validateEDLData();
    setValidationErrors(errors);
    setValidationWarnings(warnings);
    // validateEDLData est volontairement hors des deps : on veut déclencher
    // cet effet sur le changement de previewHtml uniquement, et lire les
    // données les plus récentes via la closure au moment du run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewHtml]);

  // === DEBOUNCE: Génération de l'aperçu avec délai ===
  // IMPORTANT: les dépendances sont volontairement réduites à des primitives
  // stables (dataHash / edlId / isVierge / previewHtml). Inclure `edlData`,
  // `validateEDLData`, `toast` ou `html` relançait l'effet à chaque render du
  // parent (nouvelle référence d'objet), ce qui réinitialisait le timer de
  // debounce et laissait l'aperçu bloqué sur "Génération de l'aperçu…".
  useEffect(() => {
    if (previewHtml !== undefined) return;

    if (lastHashRef.current === dataHash && htmlRef.current) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const { errors, warnings } = validateEDLData();

        if (edlId) {
          setValidationErrors([]);
          setValidationWarnings([]);
        } else {
          setValidationErrors(errors);
          setValidationWarnings(warnings);
        }

        if (errors.length > 0 && !isVierge && !edlId) {
          setHtml("");
          return;
        }

        const currentEdlData = edlDataRef.current;
        const currentRooms = roomsRef.current;
        const response = await fetch("/api/edl/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            edlData: currentEdlData,
            edlId,
            isVierge,
            rooms: isVierge ? currentRooms : undefined,
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
        toastRef.current({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataHash, edlId, isVierge, previewHtml]);

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

      await html2pdf().set(opt as any).from(element).save();
      
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
      <CardHeader className="pb-3 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            <CardTitle className="text-sm sm:text-lg truncate">
              {isVierge ? "Template EDL" : "Aperçu état des lieux"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="h-9 w-9 p-0"
              aria-label="Actualiser l'aperçu"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              disabled={!html || loading}
              className="h-9 w-9 p-0 hidden sm:flex"
              aria-label="Imprimer"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={!html || downloading || loading}
              className="h-9 w-9 p-0"
              aria-label="Télécharger le PDF"
            >
              {downloading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            <Dialog open={fullscreen} onOpenChange={setFullscreen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0" disabled={!html} aria-label="Plein écran">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[90vw] max-h-[95vh] sm:max-h-[90vh] p-0" aria-describedby={undefined}>
                <DialogHeader className="p-3 sm:p-4 border-b">
                  <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5" />
                    État des lieux {edlData.type === "sortie" ? "de sortie" : "d'entrée"}
                  </DialogTitle>
                </DialogHeader>
                <div className="h-[85vh] sm:h-[80vh] overflow-hidden">
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

        {/* Badge type EDL — responsive */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap">
          <Badge variant={edlData.type === "sortie" ? "destructive" : "default"} className="text-[10px] sm:text-xs">
            EDL {edlData.type === "sortie" ? "de sortie" : "d'entrée"}
          </Badge>
          {isVierge && (
            <Badge variant="secondary" className="text-[10px] sm:text-xs">Template vierge</Badge>
          )}
          {lastGenerated && (
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              Généré à {lastGenerated.toLocaleTimeString("fr-FR")}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
        {/* Statistiques si EDL numérique — responsive grid */}
        {stats && !isVierge && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 sm:p-3 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-base sm:text-lg font-bold text-green-600">{stats.nbBon}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Bon</div>
            </div>
            <div className="text-center">
              <div className="text-base sm:text-lg font-bold text-yellow-600">{stats.nbMoyen}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Moyen</div>
            </div>
            <div className="text-center">
              <div className="text-base sm:text-lg font-bold text-orange-600">{stats.nbMauvais}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Mauvais</div>
            </div>
            <div className="text-center">
              <div className="text-base sm:text-lg font-bold text-red-600">{stats.nbTresMauvais}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Très mauvais</div>
            </div>
          </div>
        )}

        {stats && !isVierge && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] sm:text-xs">
              <span>État général</span>
              <span className="font-medium">{stats.pourcentageBon}% en bon état</span>
            </div>
            <Progress value={stats.pourcentageBon} className="h-1.5 sm:h-2" />
          </div>
        )}

        {/* Erreurs de validation */}
        <AnimatePresence>
          {validationErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-2.5 sm:p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-red-800 text-xs sm:text-sm">
                    Données manquantes ({validationErrors.length})
                  </p>
                  <ul className="text-xs sm:text-sm text-red-600 space-y-0.5">
                    {validationErrors.map((error, i) => (
                      <li key={i} className="break-words">• {error}</li>
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
              className="p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-amber-800 text-xs sm:text-sm">
                    Recommandations ({validationWarnings.length})
                  </p>
                  <ul className="text-xs sm:text-sm text-amber-600 space-y-0.5">
                    {validationWarnings.slice(0, 3).map((warning, i) => (
                      <li key={i} className="break-words">• {warning}</li>
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

        {/* Aperçu iframe — hauteur responsive adaptative */}
        <div className="relative bg-white border rounded-lg overflow-hidden shadow-inner min-h-[250px] sm:min-h-[350px]">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 px-4">
              <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary mb-3" />
              <p className="text-xs sm:text-sm text-muted-foreground text-center">Génération de l&apos;aperçu...</p>
            </div>
          ) : validationErrors.length > 0 && !isVierge && !edlId ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 px-4">
              <FileText className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground/50 mb-3" />
              <p className="text-xs sm:text-sm text-muted-foreground text-center">
                Complétez les informations requises pour voir l&apos;aperçu
              </p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              className="w-full h-[45vh] sm:h-[55vh] md:h-[500px] lg:h-[600px] border-0"
              title="Aperçu de l'état des lieux"
            />
          )}
        </div>

        {/* Footer informatif */}
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-[10px] sm:text-xs text-muted-foreground">
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

