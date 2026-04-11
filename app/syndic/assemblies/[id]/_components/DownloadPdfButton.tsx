"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Download, FileText, Loader2 } from "lucide-react";

interface DownloadPdfButtonProps {
  variant: "convocation" | "minute";
  assemblyId?: string;
  minuteId?: string;
  unitId?: string;
  label?: string;
  filename?: string;
  className?: string;
}

/**
 * Bouton de téléchargement PDF pour convocations et PV.
 *
 * Workflow:
 * 1. Fetch du HTML depuis l'API
 * 2. Conversion HTML → PDF via html2pdf.js (dynamique)
 * 3. Download du fichier PDF
 *
 * Graceful degradation : si html2pdf échoue, ouvre le HTML dans un nouvel onglet
 * (l'utilisateur peut alors imprimer en PDF via le navigateur).
 */
export function DownloadPdfButton({
  variant,
  assemblyId,
  minuteId,
  unitId,
  label,
  filename,
  className,
}: DownloadPdfButtonProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      // 1. Construire l'URL
      let url: string;
      if (variant === "convocation") {
        if (!assemblyId) throw new Error("assemblyId manquant");
        url = `/api/copro/assemblies/${assemblyId}/convocation-pdf`;
        if (unitId) url += `?unit_id=${unitId}`;
      } else {
        if (!minuteId) throw new Error("minuteId manquant");
        url = `/api/copro/minutes/${minuteId}/pdf`;
      }

      // 2. Fetch le HTML
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur de génération");
      }
      const html = await res.text();

      // 3. Charger html2pdf dynamiquement (bundle client only)
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = (html2pdfModule as any).default || html2pdfModule;

      // 4. Créer un élément temporaire
      const element = document.createElement("div");
      element.innerHTML = html;
      element.style.width = "210mm"; // A4

      // 5. Générer le PDF
      const defaultFilename =
        variant === "convocation" ? "convocation.pdf" : "proces-verbal.pdf";
      const outputFilename = filename || defaultFilename;

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: outputFilename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(element)
        .save();

      toast({
        title: "Téléchargement démarré",
        description: outputFilename,
      });
    } catch (error) {
      console.error("[DownloadPdfButton]", error);
      // Fallback : ouvrir le HTML dans un nouvel onglet
      try {
        let fallbackUrl: string;
        if (variant === "convocation" && assemblyId) {
          fallbackUrl = `/api/copro/assemblies/${assemblyId}/convocation-pdf${unitId ? `?unit_id=${unitId}` : ""}`;
        } else if (variant === "minute" && minuteId) {
          fallbackUrl = `/api/copro/minutes/${minuteId}/pdf`;
        } else {
          throw new Error("Paramètres invalides");
        }
        window.open(fallbackUrl, "_blank");
        toast({
          title: "Aperçu HTML ouvert",
          description: "Utilisez Ctrl+P pour imprimer en PDF",
        });
      } catch {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Impossible de télécharger",
          variant: "destructive",
        });
      }
    } finally {
      setDownloading(false);
    }
  };

  const Icon = variant === "convocation" ? FileText : Download;
  const defaultLabel = variant === "convocation" ? "Convocation PDF" : "Télécharger PDF";

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleDownload}
      disabled={downloading}
      className={className || "border-white/20 text-white hover:bg-white/10"}
    >
      {downloading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 mr-2" />
      )}
      {label || defaultLabel}
    </Button>
  );
}
