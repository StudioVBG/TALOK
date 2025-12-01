"use client";

/**
 * SignaturePad - Composant de signature tactile
 * Permet de signer avec le doigt ou le stylet sur écran tactile
 * SOTA 2025 avec canvas optimisé et support multi-touch
 */

import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Pen } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  /** Label au-dessus du pad */
  label?: string;
  /** Désactiver le pad */
  disabled?: boolean;
  /** Callback quand la signature change */
  onSignatureChange?: (isEmpty: boolean, dataUrl: string | null) => void;
  /** Couleur du trait */
  strokeColor?: string;
  /** Épaisseur du trait */
  strokeWidth?: number;
  /** Hauteur du canvas */
  height?: number;
  /** Classes CSS additionnelles */
  className?: string;
}

export interface SignaturePadRef {
  /** Effacer la signature */
  clear: () => void;
  /** Vérifier si le pad est vide */
  isEmpty: () => boolean;
  /** Obtenir la signature en base64 PNG */
  toDataURL: () => string;
  /** Obtenir la signature en Blob */
  toBlob: () => Promise<Blob | null>;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  (
    {
      label,
      disabled = false,
      onSignatureChange,
      strokeColor = "#1a1a2e",
      strokeWidth = 2.5,
      height = 150,
      className,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const [canvasReady, setCanvasReady] = useState(false);

    // Initialiser le canvas
    const initCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Taille responsive avec support Retina
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);

      // Style de ligne
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Fond blanc
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, height);

      setCanvasReady(true);
    }, [height, strokeColor, strokeWidth]);

    // Initialiser au montage et au resize
    useEffect(() => {
      initCanvas();

      const handleResize = () => {
        if (hasSignature) return; // Ne pas réinitialiser si déjà signé
        initCanvas();
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [initCanvas, hasSignature]);

    // Exposer les méthodes via ref
    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const rect = container.getBoundingClientRect();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, height);

        setHasSignature(false);
        onSignatureChange?.(true, null);
      },

      isEmpty: () => !hasSignature,

      toDataURL: () => {
        const canvas = canvasRef.current;
        if (!canvas) return "";
        return canvas.toDataURL("image/png");
      },

      toBlob: () => {
        return new Promise((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas) {
            resolve(null);
            return;
          }
          canvas.toBlob(resolve, "image/png");
        });
      },
    }));

    // Obtenir les coordonnées (mouse ou touch)
    const getCoordinates = (
      e: React.MouseEvent | React.TouchEvent
    ): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();

      if ("touches" in e) {
        if (e.touches.length === 0) return null;
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }

      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    // Commencer le dessin
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled || !canvasReady) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      const coords = getCoordinates(e);
      if (!coords) return;

      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      setIsDrawing(true);
    };

    // Dessiner
    const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      const coords = getCoordinates(e);
      if (!coords) return;

      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      if (!hasSignature) {
        setHasSignature(true);
        const dataUrl = canvas?.toDataURL("image/png") || null;
        onSignatureChange?.(false, dataUrl);
      }
    };

    // Arrêter le dessin
    const stopDrawing = () => {
      if (isDrawing) {
        setIsDrawing(false);
        // Notifier le changement final
        const canvas = canvasRef.current;
        const dataUrl = canvas?.toDataURL("image/png") || null;
        onSignatureChange?.(!hasSignature, dataUrl);
      }
    };

    // Effacer
    const handleClear = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = container.getBoundingClientRect();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, height);

      setHasSignature(false);
      onSignatureChange?.(true, null);
    };

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Pen className="w-3.5 h-3.5" />
            {label}
          </label>
        )}

        <div
          ref={containerRef}
          className="relative w-full"
          style={{ height: `${height}px` }}
        >
          <canvas
            ref={canvasRef}
            className={cn(
              "w-full rounded-xl border-2 border-dashed transition-all duration-200",
              disabled
                ? "bg-muted/50 cursor-not-allowed border-muted"
                : "bg-white cursor-crosshair border-primary/30 hover:border-primary/50",
              hasSignature && "border-solid border-primary",
              isDrawing && "border-primary shadow-lg shadow-primary/10"
            )}
            style={{
              touchAction: "none", // Empêcher le scroll sur mobile
              height: `${height}px`,
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
          />

          {/* Placeholder */}
          {!hasSignature && !disabled && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-muted-foreground/40 text-sm flex items-center gap-2">
                <Pen className="w-4 h-4" />
                Signez ici avec le doigt
              </span>
            </div>
          )}

          {/* Bouton effacer */}
          {hasSignature && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full bg-background/80 backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive"
              onClick={handleClear}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}

          {/* Indicateur "en cours" */}
          {isDrawing && (
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              ✏️ En cours...
            </div>
          )}
        </div>

        {/* Aide */}
        {!disabled && (
          <p className="text-xs text-muted-foreground/60">
            Utilisez votre doigt ou un stylet pour signer
          </p>
        )}
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";

