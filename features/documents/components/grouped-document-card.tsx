"use client";

/**
 * GroupedDocumentCard — Affiche une paire CNI recto+verso comme une seule carte.
 *
 * Utilisé dans :
 *   - features/documents/components/documents-list.tsx  (onDelete)
 *   - app/tenant/documents/page.tsx                     (onPreview / onDownload)
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { User, Download, Eye, Trash2 } from "lucide-react";
import { documentsService } from "../services/documents.service";
import { formatDateShort } from "@/lib/helpers/format";
import type { GroupedDocument } from "@/lib/documents/group-documents";

interface GroupedDocumentCardProps {
  document: GroupedDocument;
  /** Callback après suppression (contexte features/) */
  onDelete?: () => void;
  /** Callback preview (contexte tenant) */
  onPreview?: (doc: { id: string; type: string; created_at: string; [key: string]: any }) => void;
  /** Callback download (contexte tenant) */
  onDownload?: (doc: { id: string; type: string; created_at: string; [key: string]: any }) => void;
}

export function GroupedDocumentCard({
  document: grouped,
  onDelete,
  onPreview,
  onDownload,
}: GroupedDocumentCardProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState<"recto" | "verso" | null>(null);

  const handleDownloadDoc = async (side: "recto" | "verso") => {
    const doc = side === "recto" ? grouped.recto : grouped.verso;
    if (!doc) return;

    if (onDownload) {
      onDownload(doc);
      return;
    }

    setDownloading(side);
    try {
      const url = await documentsService.getSignedUrl(doc);
      window.open(url, "_blank");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de télécharger.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handlePreviewDoc = (side: "recto" | "verso") => {
    const doc = side === "recto" ? grouped.recto : grouped.verso;
    if (!doc || !onPreview) return;
    onPreview(doc);
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer la pièce d'identité (recto et verso) ?")) return;

    setDeleting(true);
    try {
      await documentsService.deleteDocument(grouped.recto.id);
      if (grouped.verso) {
        await documentsService.deleteDocument(grouped.verso.id);
      }
      toast({ title: "Documents supprimés" });
      onDelete?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-purple-600" />
            <div>
              <CardTitle className="text-lg">Pièce d'identité</CardTitle>
              <CardDescription>
                Ajouté le {formatDateShort(grouped.created_at)}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-purple-600 border-purple-200 bg-purple-50"
          >
            {grouped.verso ? "Recto + Verso" : "Recto seulement"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Recto */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
          <span className="text-sm font-medium text-muted-foreground">Recto</span>
          <div className="flex gap-1">
            {onPreview && (
              <Button variant="ghost" size="sm" onClick={() => handlePreviewDoc("recto")}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadDoc("recto")}
              disabled={downloading === "recto"}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              {downloading === "recto" ? "..." : "Recto"}
            </Button>
          </div>
        </div>

        {/* Verso */}
        {grouped.verso ? (
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <span className="text-sm font-medium text-muted-foreground">Verso</span>
            <div className="flex gap-1">
              {onPreview && (
                <Button variant="ghost" size="sm" onClick={() => handlePreviewDoc("verso")}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadDoc("verso")}
                disabled={downloading === "verso"}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                {downloading === "verso" ? "..." : "Verso"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-1">
            Verso non encore uploadé
          </p>
        )}

        {/* Bouton suppression (contexte owner/features) */}
        {onDelete && (
          <div className="flex justify-end pt-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {deleting ? "Suppression..." : "Supprimer"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
