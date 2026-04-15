"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Maximize2, RefreshCw, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface LeasePreviewProps {
  leaseId: string;
}

export function LeasePreview({ leaseId }: LeasePreviewProps) {
  const [html, setHtml] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isSealed, setIsSealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const fetchLeaseHtml = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      setIframeFailed(false);
      const response = await fetch(`/api/leases/${leaseId}/html`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.sealed && data.pdfUrl) {
        setPdfUrl(data.pdfUrl);
        setIsSealed(true);
        setHtml("");
      } else if (typeof data.html === "string" && data.html.length > 0) {
        setHtml(data.html);
        setPdfUrl(null);
        setIsSealed(false);
      } else {
        // Ni PDF signé, ni HTML : impossible d'afficher l'aperçu
        console.error("[LeasePreview] Réponse API vide — ni pdfUrl ni html", { leaseId, data });
        setHtml("");
        setPdfUrl(null);
        setIsSealed(false);
        setFetchError("Le document n'est pas encore disponible");
      }
      setIframeKey(prev => prev + 1);
    } catch (error) {
      console.error("LeasePreview Error:", error);
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setFetchError(message);
      setHtml("");
      setPdfUrl(null);
      setIsSealed(false);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'aperçu du bail",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [leaseId, toast]);

  useEffect(() => {
    fetchLeaseHtml();
  }, [fetchLeaseHtml]);

  // Ensure srcdoc is applied directly on the DOM element as a fallback.
  // React's attribute reconciliation may not reliably update srcdoc on
  // existing iframes in all browsers.
  useEffect(() => {
    if (iframeRef.current && html && !isSealed) {
      iframeRef.current.srcdoc = html;
    }
  }, [html, isSealed, iframeKey]);

  useEffect(() => {
    if (fullscreenIframeRef.current && html && !isSealed && fullscreen) {
      fullscreenIframeRef.current.srcdoc = html;
    }
  }, [html, isSealed, fullscreen, iframeKey]);

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
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={!html && !pdfUrl}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] h-[95vh] p-0 flex flex-col" aria-describedby={undefined}>
              <DialogHeader className="p-4 border-b shrink-0">
                <DialogTitle>
                  {isSealed ? "Bail signé - Document définitif" : "Contrat de location - Plein écran"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0 bg-[#525659] overflow-y-auto">
                <div className="flex justify-center py-6 px-4">
                  <div className="w-full max-w-[210mm] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
                    {isSealed && pdfUrl ? (
                      <iframe
                        src={pdfUrl}
                        className="w-full border-0"
                        style={{ height: "calc(297mm * 2)" }}
                        title="Bail signé plein écran"
                      />
                    ) : html ? (
                      <iframe
                        ref={fullscreenIframeRef}
                        key={`fullscreen-${iframeKey}`}
                        srcDoc={html}
                        className="w-full border-0"
                        style={{ height: "calc(297mm * 2)" }}
                        title="Aperçu bail plein écran"
                      />
                    ) : null}
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
          ) : isSealed && pdfUrl && !iframeFailed ? (
            <div className="h-full overflow-y-auto flex justify-center py-4 px-2 sm:px-4">
              <div className="w-full max-w-[210mm] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.3)] flex-shrink-0 h-fit">
                <iframe
                  src={pdfUrl}
                  className="w-full border-0 bg-white"
                  style={{ height: "calc(297mm * 1.5)" }}
                  title="Bail signé (document définitif)"
                  onError={() => {
                    console.error("[LeasePreview] iframe PDF failed to load", { leaseId, pdfUrl });
                    setIframeFailed(true);
                  }}
                />
              </div>
            </div>
          ) : html && !iframeFailed ? (
            <div className="h-full overflow-y-auto flex justify-center py-4 px-2 sm:px-4">
              <div className="w-full max-w-[210mm] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.3)] flex-shrink-0 h-fit">
                <iframe
                  ref={iframeRef}
                  key={`preview-${iframeKey}`}
                  srcDoc={html}
                  className="w-full border-0 bg-white"
                  style={{ height: "calc(297mm * 1.5)" }}
                  title="Aperçu du bail"
                  onError={() => {
                    console.error("[LeasePreview] iframe HTML failed to load", { leaseId });
                    setIframeFailed(true);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <FileText className="h-10 w-10 text-white/40" />
              <p className="text-sm text-white/90 mt-3 font-semibold">
                Document non disponible
              </p>
              <p className="text-[11px] text-white/60 mt-1 max-w-xs">
                {fetchError
                  ? "L'aperçu du bail n'a pas pu être chargé."
                  : "L'aperçu n'est pas disponible pour le moment."}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  asChild
                  className="h-8 text-xs font-bold"
                >
                  <a
                    href={`/api/leases/${leaseId}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Télécharger le bail
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchLeaseHtml}
                  className="text-white/80 hover:text-white hover:bg-white/10 text-xs h-8"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Réessayer
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
