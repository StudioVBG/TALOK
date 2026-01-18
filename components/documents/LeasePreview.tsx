"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Maximize2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface LeasePreviewProps {
  leaseId: string;
}

export function LeasePreview({ leaseId }: LeasePreviewProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const fetchLeaseHtml = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/leases/${leaseId}/html`);
      if (!response.ok) throw new Error("Erreur lors de la récupération du bail");
      
      const data = await response.json();
      setHtml(data.html);
    } catch (error) {
      console.error("LeasePreview Error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'aperçu du bail",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaseHtml();
  }, [leaseId]);

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

  return (
    <Card className="h-full">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg">Aperçu du contrat</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLeaseHtml}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={fullscreen} onOpenChange={setFullscreen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={!html}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
              <DialogHeader className="p-4 border-b">
                <DialogTitle>Contrat de location - Plein écran</DialogTitle>
              </DialogHeader>
              <div className="h-[80vh] overflow-hidden">
                <iframe
                  srcDoc={html}
                  className="w-full h-full border-0"
                  title="Aperçu bail plein écran"
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Conteneur responsive avec hauteur adaptative */}
        <div className="relative bg-slate-100 min-h-[300px] sm:min-h-[400px] md:min-h-[500px]">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs sm:text-sm text-muted-foreground text-center">Chargement du contrat...</p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              className="w-full h-[50vh] sm:h-[60vh] md:h-[70vh] max-h-[700px] border-0 bg-white"
              title="Aperçu du bail"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

