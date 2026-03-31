"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { documentsService } from "../services/documents.service";
import { formatDateShort } from "@/lib/helpers/format";
import { CreditCard } from "lucide-react";
import type { GroupedDocumentItem, DocumentLike } from "@/lib/documents/group-documents";

interface GroupedDocumentCardProps {
  item: GroupedDocumentItem;
  onDelete?: () => void;
}

export function GroupedDocumentCard({ item, onDelete }: GroupedDocumentCardProps) {
  const { toast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");
  const [loading, setLoading] = useState(false);

  const parts = item.parts || [];
  const recto = parts.find((p) => p.type === "cni_recto");
  const verso = parts.find((p) => p.type === "cni_verso");

  const handlePreview = async (doc: DocumentLike, label: string) => {
    setLoading(true);
    try {
      const url = await documentsService.getSignedUrl(doc as any);
      setPreviewUrl(url);
      setPreviewLabel(label);
      setPreviewOpen(true);
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger l'apercu.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">{item.label}</CardTitle>
                <CardDescription>
                  {parts.length === 2 ? "Recto + Verso" : `${parts.length} face(s)`}
                  {item.latestDate && ` - ${formatDateShort(item.latestDate)}`}
                </CardDescription>
              </div>
            </div>
            <Badge variant={parts.length === 2 ? "default" : "secondary"}>
              {parts.length}/2
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {recto && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => handlePreview(recto, "Recto")}
              >
                Recto
              </Button>
            )}
            {verso && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => handlePreview(verso, "Verso")}
              >
                Verso
              </Button>
            )}
            {!recto && (
              <span className="text-xs text-muted-foreground">Recto manquant</span>
            )}
            {!verso && (
              <span className="text-xs text-muted-foreground">Verso manquant</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{item.label} - {previewLabel}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex items-center justify-center min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={`${item.label} ${previewLabel}`}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
