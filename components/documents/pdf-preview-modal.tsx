"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string | null;
  documentTitle?: string;
  documentType?: string;
}

export function PDFPreviewModal({
  isOpen,
  onClose,
  documentUrl,
  documentTitle = "Document",
  documentType,
}: PDFPreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleFullscreen = () => setIsFullscreen(!isFullscreen);

  const handleDownload = () => {
    if (documentUrl) {
      const link = document.createElement("a");
      link.href = documentUrl;
      link.download = documentTitle;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Extraire l'URL sans les paramètres de requête pour détecter le type
  const urlWithoutParams = documentUrl?.split("?")[0] || "";
  const isPDF = urlWithoutParams.toLowerCase().includes(".pdf") || documentType === "application/pdf";
  const isImage = urlWithoutParams.match(/\.(jpg|jpeg|png|gif|webp)$/i) || 
                  documentType?.startsWith("cni") || 
                  documentType?.includes("identite");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          // Taille responsive : plein écran sur mobile, contrainte sur desktop
          "w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-5xl",
          "h-[calc(100vh-1rem)] sm:h-[85vh]",
          "flex flex-col p-0",
          // Fullscreen override
          isFullscreen && "max-w-[100vw] w-screen h-screen m-0 rounded-none"
        )}
      >
        {/* Header - Responsive avec toolbar adaptative */}
        <DialogHeader className="px-3 sm:px-4 py-2 sm:py-3 border-b bg-slate-50 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            {/* Titre du document */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm sm:text-lg font-semibold truncate">{documentTitle}</DialogTitle>
                {documentType && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">{documentType}</span>
                )}
              </div>
            </div>

            {/* Toolbar - Layout adaptatif mobile/desktop */}
            <div className="flex items-center justify-between sm:justify-end gap-1 overflow-x-auto" role="toolbar" aria-label="Outils de visualisation">
              {/* Groupe zoom - caché sur très petit écran */}
              <div className="hidden xs:flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  className="h-9 w-9 sm:h-11 sm:w-11"
                  aria-label="Dézoomer"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs sm:text-sm font-medium w-10 sm:w-12 text-center" aria-live="polite">{zoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  className="h-9 w-9 sm:h-11 sm:w-11"
                  aria-label="Zoomer"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-5 sm:h-6 bg-slate-200 mx-1 sm:mx-2 hidden sm:block" aria-hidden="true" />
              </div>

              {/* Rotation */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRotate}
                className="h-9 w-9 sm:h-11 sm:w-11"
                aria-label="Pivoter le document"
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              {/* Plein écran */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFullscreen}
                className="h-9 w-9 sm:h-11 sm:w-11"
                aria-label={isFullscreen ? "Quitter le plein écran" : "Afficher en plein écran"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>

              <div className="w-px h-5 sm:h-6 bg-slate-200 mx-1 sm:mx-2" aria-hidden="true" />

              {/* Télécharger - texte caché sur mobile */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-1 sm:gap-2 h-9 sm:h-11 px-2 sm:px-3"
                aria-label={`Télécharger ${documentTitle}`}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Télécharger</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content - Zone de prévisualisation responsive */}
        <div className="flex-1 overflow-auto bg-slate-100 relative min-h-0">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="flex flex-col items-center gap-3 px-4 text-center">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600" />
                <span className="text-xs sm:text-sm text-muted-foreground">Chargement du document...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="flex flex-col items-center gap-3 text-center p-4 sm:p-6 max-w-sm">
                <div className="p-2 sm:p-3 bg-red-100 rounded-full">
                  <X className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
                <p className="text-xs sm:text-sm text-red-600 font-medium">Impossible de charger le document</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={handleDownload} className="mt-2">
                  Télécharger à la place
                </Button>
              </div>
            </div>
          )}

          {documentUrl && (
            <div
              className="flex items-center justify-center w-full h-full p-2 sm:p-4"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
                transition: "transform 0.2s ease",
              }}
            >
              {isPDF ? (
                <iframe
                  src={`${documentUrl}#toolbar=0&navpanes=0`}
                  className="w-full h-full min-h-[50vh] sm:min-h-[60vh] bg-white shadow-lg rounded-lg"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setError("Le PDF n'a pas pu être chargé");
                  }}
                  title={documentTitle}
                />
              ) : isImage ? (
                <img
                  src={documentUrl}
                  alt={documentTitle}
                  className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setError("L'image n'a pas pu être chargée");
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 sm:gap-4 text-center p-4 sm:p-8">
                  <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-slate-400" />
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Prévisualisation non disponible pour ce type de fichier
                  </p>
                  <Button onClick={handleDownload} size="sm" className="sm:text-base">
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger le fichier
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PDFPreviewModal;

