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
    <Card className="h-full flex flex-col">
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
            <DialogContent className="max-w-[95vw] h-[95vh] p-0 flex flex-col" aria-describedby={undefined}>
              <DialogHeader className="p-4 border-b shrink-0">
                <DialogTitle>Contrat de location - Plein écran</DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0 bg-[#525659] overflow-y-auto">
                <div className="flex justify-center py-6 px-4">
                  <div className="w-full max-w-[210mm] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
                    <iframe
                      srcDoc={html}
                      className="w-full border-0"
                      style={{ height: "calc(297mm * 2)" }}
                      title="Aperçu bail plein écran"
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        {/* Conteneur A4 Document Viewer */}
        <div className="relative bg-[#525659] flex-1 min-h-[400px]">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs sm:text-sm text-white/80 text-center">Chargement du contrat...</p>
            </div>
          ) : (
            <div className="h-full overflow-y-auto flex justify-center py-4 px-2 sm:px-4">
              <div className="w-full max-w-[210mm] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.3)] flex-shrink-0 h-fit">
                <iframe
                  ref={iframeRef}
                  className="w-full border-0 bg-white"
                  style={{ height: "calc(297mm * 1.5)" }}
                  title="Aperçu du bail"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

