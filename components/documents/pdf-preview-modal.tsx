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

  const isPDF = documentUrl?.toLowerCase().includes(".pdf") || documentType === "application/pdf";
  const isImage = documentUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={cn(
          "max-w-5xl h-[85vh] flex flex-col p-0",
          isFullscreen && "max-w-[100vw] h-[100vh] m-0 rounded-none"
        )}
      >
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b bg-slate-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">{documentTitle}</DialogTitle>
                {documentType && (
                  <span className="text-xs text-muted-foreground uppercase">{documentType}</span>
                )}
              </div>
            </div>
            
            {/* Toolbar */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="h-8 w-8"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                className="h-8 w-8"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              
              <div className="w-px h-6 bg-slate-200 mx-2" />
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRotate}
                className="h-8 w-8"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFullscreen}
                className="h-8 w-8"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              
              <div className="w-px h-6 bg-slate-200 mx-2" />
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Télécharger
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-100 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="text-sm text-muted-foreground">Chargement du document...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="flex flex-col items-center gap-3 text-center p-6">
                <div className="p-3 bg-red-100 rounded-full">
                  <X className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-sm text-red-600 font-medium">Impossible de charger le document</p>
                <p className="text-xs text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  Télécharger à la place
                </Button>
              </div>
            </div>
          )}

          {documentUrl && (
            <div 
              className="flex items-center justify-center min-h-full p-4"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
                transition: "transform 0.2s ease",
              }}
            >
              {isPDF ? (
                <iframe
                  src={`${documentUrl}#toolbar=0&navpanes=0`}
                  className="w-full h-full min-h-[70vh] bg-white shadow-lg rounded-lg"
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
                <div className="flex flex-col items-center gap-4 text-center p-8">
                  <FileText className="h-16 w-16 text-slate-400" />
                  <p className="text-muted-foreground">
                    Prévisualisation non disponible pour ce type de fichier
                  </p>
                  <Button onClick={handleDownload}>
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

