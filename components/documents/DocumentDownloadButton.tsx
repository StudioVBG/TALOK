"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileSignature, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface DocumentDownloadButtonProps {
  documentId?: string;
  leaseId?: string;
  edlId?: string;
  type: "lease" | "edl" | "receipt" | "other";
  variant?: "outline" | "default" | "ghost";
  className?: string;
  label?: string;
  fileName?: string;
  signed?: boolean;
}

export function DocumentDownloadButton({
  documentId,
  leaseId,
  edlId,
  type,
  variant = "outline",
  className,
  label,
  fileName,
  signed = false,
}: DocumentDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      // Cas 1: Quittance (déjà stockée dans Storage)
      if (type === "receipt") {
        const id = documentId || leaseId; // Pour les quittances, on utilise souvent l'ID de facture ou doc
        window.open(`/api/invoices/${id}/receipt`, "_blank");
        return;
      }

      // Cas 1.5: Document générique (CNI, Assurance, etc.) déjà dans Storage
      if (type === "other") {
        window.open(`/api/documents/${documentId}/download`, "_blank");
        return;
      }

      // Cas 2: Bail ou EDL (Génération HTML -> PDF avec html2pdf.js)
      let apiUrl = "";
      let body: any = {};

      if (type === "lease") {
        // Utiliser la nouvelle route HTML pour une meilleure qualité
        const response = await fetch(`/api/leases/${leaseId}/html`);
        if (!response.ok) throw new Error("Erreur génération document");
        
        const { html: pdfHtml, fileName: generatedFileName } = await response.json();
        const html2pdf = (await import("html2pdf.js")).default;
        
        const opt = {
          margin: 10,
          filename: fileName || generatedFileName || `bail.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        const element = document.createElement("div");
        element.innerHTML = pdfHtml;
        document.body.appendChild(element);
        await html2pdf().set(opt).from(element).save();
        document.body.removeChild(element);
        
        toast({
          title: "Téléchargement démarré",
          description: "Votre bail est en cours de préparation.",
        });
        return;
      }

      if (type === "edl") {
        // Pour l'EDL, on utilise la logique html2pdf.js éprouvée
        const response = await fetch("/api/edl/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ edlId }),
        });

        if (!response.ok) throw new Error("Erreur génération document");
        
        const { html: pdfHtml, fileName: generatedFileName } = await response.json();
        const html2pdf = (await import("html2pdf.js")).default;
        
        const opt = {
          margin: 10,
          filename: fileName || generatedFileName || `document.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        const element = document.createElement("div");
        element.innerHTML = pdfHtml;
        document.body.appendChild(element);
        await html2pdf().set(opt).from(element).save();
        document.body.removeChild(element);
      }

      toast({
        title: "Téléchargement démarré",
        description: "Votre document est en cours de préparation.",
      });
    } catch (error: unknown) {
      console.error("Erreur téléchargement:", error);
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le document.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const Icon = signed ? FileSignature : Download;

  return (
    <Button
      variant={variant}
      className={className}
      onClick={handleDownload}
      disabled={isDownloading}
    >
      {isDownloading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Icon className="h-4 w-4 mr-2" />
      )}
      {label || (signed ? "PDF Signé" : "Télécharger PDF")}
    </Button>
  );
}

