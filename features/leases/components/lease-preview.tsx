"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Printer,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  Check,
  AlertTriangle,
  X,
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
import { Skeleton } from "@/components/ui/skeleton";
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

const typeBadgeColors: Record<TypeBail, string> = {
  nu: "bg-gray-100 text-gray-800",
  meuble: "bg-blue-100 text-blue-800",
  colocation: "bg-purple-100 text-purple-800",
  saisonnier: "bg-amber-100 text-amber-800",
  mobilite: "bg-green-100 text-green-800",
};

export function LeasePreview({
  typeBail,
  bailData,
  leaseId,
  draftId,
  onGenerated,
}: LeasePreviewProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  // Valider les données du bail
  const validateBailData = (): string[] => {
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
  };

  // Générer la prévisualisation HTML
  const generatePreview = async () => {
    setLoading(true);
    const errors = validateBailData();
    setValidationErrors(errors);

    try {
      const previewHtml = pdfService.previewLease(typeBail, bailData);
      setHtml(previewHtml);
      setShowPreview(true);
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
  };

  // Générer le PDF final
  const generatePDF = async () => {
    const errors = validateBailData();
    if (errors.length > 0) {
      toast({
        title: "Données incomplètes",
        description: "Veuillez corriger les erreurs avant de générer le PDF",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);

    try {
      const result = await pdfService.generateLeaseDocument({
        typeBail,
        bailData,
        leaseId,
        draftId,
        generatePDF: true,
      });

      if (result.url && result.path) {
        toast({
          title: "PDF généré",
          description: "Le bail a été généré avec succès",
        });
        onGenerated?.({ url: result.url, path: result.path });
      }
    } catch (error: unknown) {
      console.error("Erreur génération PDF:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Imprimer le bail
  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  // Télécharger le HTML
  const handleDownloadHTML = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bail-${typeBail}-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Prévisualisation du bail</CardTitle>
              <CardDescription>
                Vérifiez le contenu avant génération
              </CardDescription>
            </div>
          </div>
          <Badge className={typeBadgeColors[typeBail]}>
            {typeLabels[typeBail]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Erreurs de validation */}
        <AnimatePresence>
          {validationErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800">
                    Données incomplètes ({validationErrors.length})
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-700">
                    {validationErrors.map((error, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Boutons d'action */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={generatePreview}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : showPreview ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {showPreview ? "Actualiser" : "Prévisualiser"}
          </Button>

          {showPreview && (
            <>
              <Button onClick={handlePrint} variant="outline">
                <Printer className="mr-2 h-4 w-4" />
                Imprimer
              </Button>

              <Button onClick={handleDownloadHTML} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                HTML
              </Button>

              <Dialog open={fullscreen} onOpenChange={setFullscreen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Maximize2 className="mr-2 h-4 w-4" />
                    Plein écran
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] h-[95vh] p-0">
                  <DialogHeader className="p-4 border-b">
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
                  <iframe
                    srcDoc={html}
                    className="w-full flex-1 border-0"
                    title="Prévisualisation du bail"
                  />
                </DialogContent>
              </Dialog>
            </>
          )}

          <div className="flex-1" />

          <Button
            onClick={generatePDF}
            disabled={generating || validationErrors.length > 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {generating ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Générer le PDF
          </Button>
        </div>

        {/* Zone de prévisualisation */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="border rounded-lg overflow-hidden bg-white"
            >
              {loading ? (
                <div className="p-8 space-y-4">
                  <Skeleton className="h-8 w-3/4 mx-auto" />
                  <Skeleton className="h-4 w-1/2 mx-auto" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  srcDoc={html}
                  className="w-full h-[600px] border-0"
                  title="Prévisualisation du bail"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info légale */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <p>
            📋 Ce contrat est généré conformément à la{" "}
            <strong>loi ALUR</strong> et au{" "}
            <strong>décret n°2015-587 du 29 mai 2015</strong>.
            {typeBail === "meuble" && (
              <> L'inventaire du mobilier répond aux exigences du <strong>décret n°2015-981</strong>.</>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default LeasePreview;

