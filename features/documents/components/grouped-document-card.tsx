"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { documentsService } from "../services/documents.service";
import { formatDateShort } from "@/lib/helpers/format";
import { CreditCard } from "lucide-react";
import type { GroupedDocument } from "@/lib/documents/group-documents";

interface GroupedDocumentCardProps {
  document: GroupedDocument;
  onDelete?: () => void;
}

const GROUP_LABELS: Record<string, string> = {
  cni: "Carte d'identit\u00e9",
};

const SIDE_LABELS: Record<string, string> = {
  cni_recto: "Recto",
  cni_verso: "Verso",
};

export function GroupedDocumentCard({ document, onDelete }: GroupedDocumentCardProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (docId: string) => {
    const target = document.grouped_docs.find((d) => d.id === docId);
    if (!target) return;

    setDownloading(docId);
    try {
      const url = await documentsService.getSignedUrl(target);
      window.open(url, "_blank");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de t\u00e9l\u00e9charger.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle className="text-lg">
                {GROUP_LABELS[document.group_type] || "Document group\u00e9"}
              </CardTitle>
              <CardDescription>
                {document.grouped_docs.length} faces &bull; Ajout\u00e9 le{" "}
                {formatDateShort(document.created_at)}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {document.grouped_docs.length} fichiers
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {document.grouped_docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  {SIDE_LABELS[doc.type] || doc.type}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                  {doc.storage_path.split(".").pop()?.toUpperCase() || "FILE"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(doc.id)}
                disabled={downloading === doc.id}
              >
                {downloading === doc.id ? "..." : "Voir"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
