"use client";

import { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PenTool,
  Type,
  Eraser,
  Check,
  RotateCcw,
  Smartphone,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SignatureData {
  type: "draw" | "text";
  data: string; // Base64 image ou texte
  timestamp: string;
  metadata: {
    userAgent: string;
    screenSize: string;
    touchDevice: boolean;
  };
}

interface SignaturePadProps {
  onSignatureComplete: (signature: SignatureData) => void;
  signerName: string;
  disabled?: boolean;
  className?: string;
}

// Polices cursives pour signature texte (chargées via Google Fonts dans layout.tsx)
const SIGNATURE_FONTS = [
  { name: "Dancing Script", style: "'Dancing Script', cursive" },
  { name: "Great Vibes", style: "'Great Vibes', cursive" },
  { name: "Pacifico", style: "'Pacifico', cursive" },
  { name: "Satisfy", style: "'Satisfy', cursive" },
];

export function SignaturePad({
  onSignatureComplete,
  signerName,
  disabled = false,
  className,
}: SignaturePadProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const [signatureMode, setSignatureMode] = useState<"draw" | "text">("draw");
  const [textSignature, setTextSignature] = useState(signerName);
  const [selectedFont, setSelectedFont] = useState(0);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Détecter si c'est un appareil tactile
  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  // Effacer la signature dessinée
  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setHasDrawn(false);
    }
  };

  // Générer la signature texte en image
  const generateTextSignatureImage = (): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 150;
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      // Fond transparent
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Texte de signature
      ctx.font = `48px ${SIGNATURE_FONTS[selectedFont].style}`;
      ctx.fillStyle = "#1e3a5f";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(textSignature, canvas.width / 2, canvas.height / 2);
    }
    
    return canvas.toDataURL("image/png");
  };

  // Valider et soumettre la signature
  const handleSubmit = () => {
    let signatureData: string;
    
    if (signatureMode === "draw") {
      if (!signatureRef.current || signatureRef.current.isEmpty()) {
        return;
      }
      signatureData = signatureRef.current.toDataURL("image/png");
    } else {
      if (!textSignature.trim()) {
        return;
      }
      signatureData = generateTextSignatureImage();
    }

    const signature: SignatureData = {
      type: signatureMode,
      data: signatureData,
      timestamp: new Date().toISOString(),
      metadata: {
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        touchDevice: isTouchDevice,
      },
    };

    onSignatureComplete(signature);
  };

  // Vérifier si la signature est valide
  const isSignatureValid = () => {
    if (signatureMode === "draw") {
      return hasDrawn;
    }
    return textSignature.trim().length > 0;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Indicateur appareil */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        {isTouchDevice ? (
          <>
            <Smartphone className="h-4 w-4" />
            <span>Signez avec votre doigt</span>
          </>
        ) : (
          <>
            <Monitor className="h-4 w-4" />
            <span>Signez avec votre souris ou trackpad</span>
          </>
        )}
      </div>

      {/* Tabs pour choisir le mode */}
      <Tabs
        value={signatureMode}
        onValueChange={(v) => setSignatureMode(v as "draw" | "text")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw" className="gap-2">
            <PenTool className="h-4 w-4" />
            Dessiner
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2">
            <Type className="h-4 w-4" />
            Taper
          </TabsTrigger>
        </TabsList>

        {/* Mode dessin */}
        <TabsContent value="draw" className="mt-4">
          <div className="space-y-3">
            <div
              className={cn(
                "border-2 border-dashed rounded-xl overflow-hidden bg-white",
                "transition-colors",
                hasDrawn ? "border-green-400" : "border-slate-300"
              )}
            >
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: "w-full h-40 touch-none",
                  style: { width: "100%", height: "160px" },
                }}
                penColor="#1e3a5f"
                minWidth={1.5}
                maxWidth={3}
                onBegin={() => setHasDrawn(true)}
              />
            </div>
            
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSignature}
                className="gap-1"
              >
                <Eraser className="h-4 w-4" />
                Effacer
              </Button>
              
              {!hasDrawn && (
                <p className="text-xs text-muted-foreground italic">
                  Dessinez votre signature ci-dessus
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Mode texte */}
        <TabsContent value="text" className="mt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Votre signature</Label>
              <Input
                value={textSignature}
                onChange={(e) => setTextSignature(e.target.value)}
                placeholder="Tapez votre nom complet"
                className="text-lg"
              />
            </div>

            {/* Choix de la police */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Style de signature
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {SIGNATURE_FONTS.map((font, index) => (
                  <button
                    key={font.name}
                    type="button"
                    onClick={() => setSelectedFont(index)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-left",
                      selectedFont === index
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    )}
                  >
                    <span
                      className="text-xl text-slate-800 dark:text-slate-200"
                      style={{ fontFamily: font.style }}
                    >
                      {textSignature || signerName}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aperçu */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-300">
              <p className="text-xs text-muted-foreground mb-2">Aperçu :</p>
              <p
                className="text-3xl text-center text-slate-800 dark:text-slate-200"
                style={{ fontFamily: SIGNATURE_FONTS[selectedFont].style }}
              >
                {textSignature || signerName}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bouton de validation */}
      <Button
        onClick={handleSubmit}
        disabled={disabled || !isSignatureValid()}
        className="w-full gap-2 h-12 text-lg bg-gradient-to-r from-green-600 to-emerald-600"
      >
        <Check className="h-5 w-5" />
        Valider ma signature
      </Button>

      {/* Note légale */}
      <p className="text-xs text-center text-muted-foreground">
        En validant, vous acceptez que cette signature électronique ait la même
        valeur juridique qu'une signature manuscrite (Article 1367 du Code Civil).
      </p>
    </div>
  );
}

export type { SignatureData };

