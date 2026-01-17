"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { documentsService } from "../services/documents.service";
import type { Document } from "@/lib/types";
import { formatDateShort } from "@/lib/helpers/format";
import { CheckCircle, AlertCircle, XCircle, Clock } from "lucide-react";

interface DocumentCardProps {
  document: Document;
  onDelete?: () => void;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) return;

    setDeleting(true);
    try {
      await documentsService.deleteDocument(document.id);
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès.",
      });
      onDelete?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = await documentsService.getSignedUrl(document);
      window.open(url, "_blank");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de télécharger le document.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      bail: "Bail",
      EDL_entree: "État des lieux d'entrée",
      EDL_sortie: "État des lieux de sortie",
      quittance: "Quittance de loyer",
      attestation_assurance: "Attestation d'assurance",
      attestation_loyer: "Attestation de loyer",
      justificatif_revenus: "Justificatif de revenus",
      piece_identite: "Pièce d'identité",
      autre: "Autre",
    };
    return labels[type] || type;
  };

  const getFileExtension = (path: string) => {
    return path.split(".").pop()?.toUpperCase() || "FILE";
  };

  const getVerificationBadge = () => {
    const status = (document as any).verification_status;
    if (!status) return null;

    switch (status) {
      case "verified":
        return (
          <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Vérifié
          </Badge>
        );
      case "rejected":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="flex items-center gap-1 cursor-help">
                  <XCircle className="w-3 h-3" /> Rejeté
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{(document as any).rejection_reason || "Document non conforme"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case "manual_review_required":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-amber-500 hover:bg-amber-600 flex items-center gap-1 cursor-help">
                  <AlertCircle className="w-3 h-3" /> À vérifier
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{(document as any).rejection_reason || "Vérification manuelle requise"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="flex items-center gap-1 animate-pulse">
            <Clock className="w-3 h-3" /> Analyse IA...
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div>
            <CardTitle className="text-lg">{getTypeLabel(document.type)}</CardTitle>
            <CardDescription>Ajouté le {formatDateShort(document.created_at)}</CardDescription>
          </div>
          {getVerificationBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-muted">
              {getFileExtension(document.storage_path)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading ? "..." : "Télécharger"}
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "..." : "🗑️"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

