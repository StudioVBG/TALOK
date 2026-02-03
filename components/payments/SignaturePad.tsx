"use client";

/**
 * SignaturePad - Composant de signature tactile simple
 * Utilisé dans CashReceiptFlow pour capturer les signatures
 */

import { forwardRef, useRef, useImperativeHandle, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SignaturePadRef {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

interface SignaturePadProps {
  label?: string;
  onSignatureChange?: (isEmpty: boolean) => void;
  height?: number;
  className?: string;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ label, onSignatureChange, height = 180, className }, ref) => {
    const canvasRef = useRef<SignatureCanvas>(null);
    const [hasContent, setHasContent] = useState(false);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      isEmpty: () => {
        return canvasRef.current ? canvasRef.current.isEmpty() : true;
      },
      toDataURL: () => {
        return canvasRef.current ? canvasRef.current.toDataURL("image/png") : "";
      },
      clear: () => {
        if (canvasRef.current) {
          canvasRef.current.clear();
          setHasContent(false);
          onSignatureChange?.(true);
        }
      },
    }));

    // Handle drawing events
    const handleBegin = () => {
      // Drawing has started
    };

    const handleEnd = () => {
      const isEmpty = canvasRef.current?.isEmpty() ?? true;
      setHasContent(!isEmpty);
      onSignatureChange?.(isEmpty);
    };

    const handleClear = () => {
      if (canvasRef.current) {
        canvasRef.current.clear();
        setHasContent(false);
        onSignatureChange?.(true);
      }
    };

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <p className="text-sm text-muted-foreground text-center">{label}</p>
        )}

        <div
          className={cn(
            "border-2 border-dashed rounded-xl overflow-hidden bg-white dark:bg-slate-900",
            "transition-colors",
            hasContent ? "border-green-400" : "border-slate-300 dark:border-slate-600"
          )}
        >
          <SignatureCanvas
            ref={canvasRef}
            canvasProps={{
              className: "w-full touch-none cursor-crosshair",
              style: { width: "100%", height: `${height}px` },
            }}
            penColor="#1e3a5f"
            minWidth={1.5}
            maxWidth={3}
            onBegin={handleBegin}
            onEnd={handleEnd}
          />
        </div>

        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <Eraser className="h-4 w-4" />
            Effacer
          </Button>

          {!hasContent && (
            <p className="text-xs text-muted-foreground italic">
              Signez ci-dessus
            </p>
          )}
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";
