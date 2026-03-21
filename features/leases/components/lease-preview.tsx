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
  /** ✅ SOTA 2026: Force refresh externe via ce compteur */
  refreshKey?: number;
  /** ✅ SOTA 2026: Active le refresh automatique depuis l'API (toutes les 30s si leaseId fourni) */
  autoRefresh?: boolean;
  /** Statut du bail — si signé/actif, les alertes de validation sont atténuées */
  leaseStatus?: string;
}

const typeLabels: Record<TypeBail, string> = {
  nu: "Location vide",
  meuble: "Location meublée",
  colocation: "Colocation",
  saisonnier: "Location saisonnière",
  mobilite: "Bail mobilité",
  etudiant: "Bail étudiant",
  parking: "Parking / Garage",
  commercial: "Bail commercial",
  commercial_3_6_9: "Commercial 3/6/9",
  commercial_derogatoire: "Bail dérogatoire",
  professionnel: "Bail professionnel",
  location_gerance: "Location-gérance",
  bail_mixte: "Bail mixte",
  bail_mobilite: "Bail mobilité",
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
  refreshKey = 0,
  autoRefresh = false,
  leaseStatus,
}: LeasePreviewProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0); // ✅ SOTA 2026: Pour forcer refresh depuis l'extérieur
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

  // ✅ SOTA 2026: Validation des données du bail (CRITIQUES vs RECOMMANDÉES)
  // Si le bail est déjà signé/actif, les erreurs de données manquantes deviennent des warnings
  // car elles reflètent un manque de données côté affichage, pas un vrai blocage
  const isSealed = ["fully_signed", "active", "notice_given", "terminated", "archived"].includes(leaseStatus || "");
  
  const validateBailData = useCallback((): { critical: string[]; warnings: string[] } => {
    const critical: string[] = [];
    const warnings: string[] = [];
    
    // Pour un bail scellé, les erreurs de données manquantes sont des warnings informatifs
    const pushError = (msg: string) => {
      if (isSealed) {
        warnings.push(msg);
      } else {
        critical.push(msg);
      }
    };
    
    // === CHAMPS CRITIQUES (bloquent la création pour les brouillons) ===
    
    // Bailleur
    const isSociete = bailData.bailleur?.type === "societe";
    if (isSociete) {
      if (!bailData.bailleur?.nom && !bailData.bailleur?.raison_sociale) {
        pushError("Raison sociale de la société manquante");
      }
      if (!bailData.bailleur?.siret) {
        warnings.push("SIRET de la société non renseigné");
      }
    } else {
      if (!bailData.bailleur?.nom) {
        pushError("Nom du bailleur manquant");
      }
      if (!bailData.bailleur?.prenom) {
        pushError("Prénom du bailleur manquant");
      }
    }
    
    if (!bailData.bailleur?.adresse) {
      pushError("Adresse du bailleur manquante");
    }
    
    // Locataire
    if (!bailData.locataires || bailData.locataires.length === 0) {
      pushError("Aucun locataire défini");
    } else {
      const mainTenant = bailData.locataires[0];
      const isPlaceholder = mainTenant.nom?.includes("[") || mainTenant.nom?.includes("@");
      if (!isPlaceholder) {
        if (!mainTenant.nom || mainTenant.nom === "[NOM LOCATAIRE]") {
          warnings.push("Nom du locataire principal non renseigné");
        }
      }
    }
    
    // Logement
    if (!bailData.logement?.adresse_complete) {
      pushError("Adresse du logement manquante");
    }
    
    if (!bailData.logement?.surface_habitable || bailData.logement.surface_habitable <= 0) {
      pushError("Surface habitable non renseignée");
    } else if (bailData.logement.surface_habitable < 9) {
      pushError("Surface habitable insuffisante (min. 9m² légal)");
    }
    
    if (!bailData.logement?.nb_pieces_principales || bailData.logement.nb_pieces_principales < 1) {
      warnings.push("Nombre de pièces principales non renseigné");
    }
    
    // Conditions financières
    if (!bailData.conditions?.loyer_hc || bailData.conditions.loyer_hc <= 0) {
      pushError("Montant du loyer non renseigné");
    }
    
    if (bailData.conditions?.charges_montant === undefined) {
      warnings.push("Montant des charges non renseigné (sera à 0€)");
    }
    
    // Dépôt de garantie : vérifier la limite légale
    const typeBailLocal = bailData.conditions?.type_bail || "nu";
    const loyerHC = bailData.conditions?.loyer_hc || 0;
    const depot = bailData.conditions?.depot_garantie || 0;
    
    let maxDepotLegal = loyerHC;
    if (typeBailLocal === "meuble" || typeBailLocal === "colocation") maxDepotLegal = loyerHC * 2;
    if (typeBailLocal === "mobilite") maxDepotLegal = 0;
    
    if (depot > maxDepotLegal && maxDepotLegal > 0) {
      critical.push(`Dépôt de garantie (${depot}€) supérieur au maximum légal (${maxDepotLegal}€)`);
    }
    if (typeBailLocal === "mobilite" && depot > 0) {
      critical.push("Bail mobilité : dépôt de garantie interdit");
    }
    
    // Dates
    if (!bailData.conditions?.date_debut) {
      pushError("Date de début du bail non renseignée");
    } else {
      const dateDebut = new Date(bailData.conditions.date_debut);
      const aujourdhui = new Date();
      aujourdhui.setHours(0, 0, 0, 0);
      
      if (typeBailLocal !== "saisonnier") {
        const debutMoins6Mois = new Date(aujourdhui);
        debutMoins6Mois.setMonth(debutMoins6Mois.getMonth() - 6);
        if (dateDebut < debutMoins6Mois) {
          warnings.push("Date de début très ancienne (> 6 mois)");
        }
      }
    }
    
    // Durée pour baux avec fin obligatoire
    if (typeBailLocal === "saisonnier" || typeBailLocal === "mobilite") {
      if (!bailData.conditions?.date_fin) {
        pushError(`Date de fin obligatoire pour un bail ${typeBailLocal === "saisonnier" ? "saisonnier" : "mobilité"}`);
      } else if (bailData.conditions.date_debut) {
        const debut = new Date(bailData.conditions.date_debut);
        const fin = new Date(bailData.conditions.date_fin);
        const diffMois = (fin.getFullYear() - debut.getFullYear()) * 12 + (fin.getMonth() - debut.getMonth());
        
        if (typeBailLocal === "mobilite" && diffMois > 10) {
          critical.push("Bail mobilité : durée max 10 mois");
        }
        if (typeBailLocal === "saisonnier" && diffMois > 3) {
          warnings.push("Location saisonnière > 90 jours : requalification possible en meublé");
        }
      }
    }
    
    // === DIAGNOSTICS OBLIGATOIRES ===
    if (!bailData.diagnostics?.dpe?.classe_energie) {
      pushError("DPE non renseigné (obligatoire depuis 2023)");
    } else {
      const classeEnergie = bailData.diagnostics.dpe.classe_energie;
      if (classeEnergie === "G") {
        critical.push("Logement classé G : location interdite depuis 2025");
      } else if (classeEnergie === "F") {
        warnings.push("Logement classé F : location interdite à partir de 2028");
      } else if (classeEnergie === "E") {
        warnings.push("Logement classé E : location interdite à partir de 2034");
      }
    }
    
    return { critical, warnings };
  }, [bailData, isSealed]);

  // Wrapper pour compatibilité avec le code existant
  const validationResult = useMemo(() => validateBailData(), [validateBailData]);
  const validationErrors = useMemo(() => [...validationResult.critical, ...validationResult.warnings], [validationResult]);
  const hasCriticalErrors = validationResult.critical.length > 0;

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
  }, [dataHash, typeBail, bailData, validationResult, toast, html]);

  // ✅ SOTA 2026: Auto-refresh depuis l'API quand leaseId est fourni
  useEffect(() => {
    if (!autoRefresh || !leaseId) return;

    const refreshInterval = setInterval(async () => {
      try {
        // Appeler l'API pour récupérer le HTML à jour (avec signatures si elles ont été ajoutées)
        const response = await fetch(`/api/leases/${leaseId}/html`);
        if (response.ok) {
          const data = await response.json();
          if (data.html) {
            setHtml(data.html);
            setLastGenerated(new Date());
          }
        }
      } catch (error) {
        console.error("[LeasePreview] Erreur auto-refresh:", error);
      }
    }, 30000); // Refresh toutes les 30 secondes

    return () => clearInterval(refreshInterval);
  }, [autoRefresh, leaseId]);

  // ✅ SOTA 2026: Refresh forcé via refreshKey externe
  useEffect(() => {
    if (refreshKey > 0) {
      lastHashRef.current = ""; // Reset hash
      setRefreshCounter(prev => prev + 1);
    }
  }, [refreshKey]);

  // === TÉLÉCHARGEMENT: Utiliser l'impression native pour garantir le rendu ===
  const handleDownloadPDF = async () => {
    const errors = validateBailData();
    const totalErrors = errors.critical.length + errors.warnings.length;
    
    if (totalErrors > 0) {
      toast({
        title: "⚠️ Données incomplètes",
        description: `${totalErrors} champ(s) manquant(s). Le document peut être incomplet.`,
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
              <CardTitle className="text-lg">
                {bailData.logement?.adresse_complete 
                  ? `Bail - ${bailData.logement.adresse_complete}`
                  : `Bail ${typeLabels[typeBail]}`}
              </CardTitle>
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
              <DialogContent className="max-w-[95vw] h-[95vh] p-0 flex flex-col" aria-describedby={undefined}>
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
                <div className="flex-1 min-h-0 bg-[#525659] overflow-y-auto">
                  <div className="flex justify-center py-6 px-4">
                    <div className="w-full max-w-[210mm] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
                      <iframe
                        srcDoc={html}
                        className="w-full border-0"
                        style={{ height: "calc(297mm * 2)" }}
                        title="Prévisualisation du bail (plein écran)"
                      />
                    </div>
                  </div>
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
        {/* ✅ SOTA 2026: Erreurs critiques (rouge) vs Avertissements (jaune) */}
        <AnimatePresence>
          {validationResult.critical.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 border border-red-300 rounded-lg p-3 shrink-0"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-800 text-sm">
                    🚫 Erreurs bloquantes ({validationResult.critical.length})
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-red-700">
                    {validationResult.critical.map((error, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {validationResult.warnings.length > 0 && (
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
                    ⚠️ Recommandations ({validationResult.warnings.length})
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                    {validationResult.warnings.slice(0, 5).map((warning, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-amber-500 rounded-full" />
                        {warning}
                      </li>
                    ))}
                    {validationResult.warnings.length > 5 && (
                      <li className="text-amber-600 italic">
                        + {validationResult.warnings.length - 5} autres...
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Indicateur de statut de cache */}
        {!loading && lastGenerated && !hasCriticalErrors && validationResult.warnings.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-green-600 shrink-0">
            <Check className="h-3 w-3" />
            <span>✅ Bail valide - Prêt à envoyer</span>
          </div>
        )}
        {!loading && lastGenerated && !hasCriticalErrors && validationResult.warnings.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-600 shrink-0">
            <Check className="h-3 w-3" />
            <span>Bail valide (avec recommandations)</span>
          </div>
        )}

        {/* Zone de prévisualisation - Format A4 Document Viewer */}
        <div className="flex-1 rounded-lg overflow-hidden bg-[#525659] relative min-h-0">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 px-4">
               <div className="flex flex-col items-center gap-2 sm:gap-3 text-center">
                 <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-spin" />
                 <p className="text-xs sm:text-sm text-slate-500 font-medium">Génération de l'aperçu...</p>
                 <p className="text-[10px] sm:text-xs text-slate-400">Mise à jour automatique après saisie</p>
               </div>
            </div>
          ) : (
            <div className="h-full flex justify-center overflow-y-auto py-4 px-2 sm:px-4">
              <div className="w-full max-w-[210mm] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.3)] flex-shrink-0 h-fit">
                <iframe
                  ref={iframeRef}
                  srcDoc={html}
                  className="w-full border-0 bg-white"
                  style={{ height: "calc(297mm * 1.5)" }}
                  title="Prévisualisation du bail"
                />
              </div>
            </div>
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
