"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Sun, Move, Maximize2, Loader2, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentType, DOCUMENT_TYPES } from "../types";

interface DocumentScanProps {
  documentType: DocumentType;
  side: "recto" | "verso";
  onCapture: (blob: Blob, preview: string) => void;
  onBack: () => void;
  onRetry?: () => void;
  capturedPreview?: string;
}

export function DocumentScan({
  documentType,
  side,
  onCapture,
  onBack,
  onRetry,
  capturedPreview,
}: DocumentScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const docConfig = DOCUMENT_TYPES.find((d) => d.id === documentType);
  const totalSteps = docConfig?.requiresVerso ? 2 : 1;
  const currentStep = side === "recto" ? 1 : 2;

  const initCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setCameraReady(true);
        setStream(mediaStream);
      }
    } catch (err) {
      console.error("Erreur caméra:", err);
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  }, []);

  useEffect(() => {
    if (!capturedPreview) {
      initCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [capturedPreview, initCamera, stream]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    setCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Échec de la capture"));
          },
          "image/jpeg",
          0.9
        );
      });

      const preview = canvas.toDataURL("image/jpeg", 0.9);
      onCapture(blob, preview);
    } catch (err) {
      console.error("Erreur capture:", err);
      setError("Erreur lors de la capture. Veuillez réessayer.");
    } finally {
      setCapturing(false);
    }
  };

  const tips = [
    { icon: Sun, label: "Bon éclairage" },
    { icon: Move, label: "Stable" },
    { icon: Maximize2, label: "Bien cadré" },
  ];

  // Mode prévisualisation après capture
  if (capturedPreview) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Header */}
        <div className="absolute top-0 inset-x-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-white hover:bg-white/10"
            >
              <X className="w-6 h-6" />
            </Button>
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              {currentStep}/{totalSteps}
            </Badge>
          </div>
        </div>

        {/* Image capturée */}
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-md aspect-[1.586] rounded-2xl overflow-hidden shadow-2xl"
          >
            <img
              src={capturedPreview}
              alt="Document capturé"
              className="w-full h-full object-cover"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-8 h-8 text-white" />
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Actions */}
        <div className="bg-gradient-to-t from-black via-black/95 to-transparent p-6 pt-10 space-y-4">
          <p className="text-center text-white text-lg font-medium">
            {side === "recto" ? "Recto" : "Verso"} capturé !
          </p>

          <div className="flex gap-3">
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                className="flex-1 h-14 rounded-2xl border-slate-700 text-white hover:bg-slate-800"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Reprendre
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Mode caméra
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header transparent */}
      <div className="absolute top-0 inset-x-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-white hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </Button>
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            {currentStep}/{totalSteps}
          </Badge>
        </div>
      </div>

      {/* Zone caméra avec guide */}
      <div className="flex-1 relative">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={initCamera} variant="outline" className="text-white border-white/30">
                Réessayer
              </Button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay avec découpe */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Zone de capture */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative w-[88%] aspect-[1.586] max-w-md z-10"
                style={{
                  background: "transparent",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
                }}
              >
                {/* Coins animés */}
                <div className="absolute -top-1 -left-1 w-10 h-10 border-t-[3px] border-l-[3px] border-white rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-10 h-10 border-t-[3px] border-r-[3px] border-white rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-[3px] border-l-[3px] border-white rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-[3px] border-r-[3px] border-white rounded-br-xl" />

                {/* Ligne de scan */}
                {cameraReady && (
                  <motion.div
                    className="absolute left-6 right-6 h-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                    animate={{ top: ["15%", "85%", "15%"] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}
              </motion.div>
            </div>
          </>
        )}
      </div>

      {/* Instructions en bas */}
      <div className="bg-gradient-to-t from-black via-black/95 to-transparent p-6 pt-12 space-y-5">
        <div className="text-center">
          <h2 className="text-white text-xl font-semibold mb-2">
            {side === "recto" ? "Recto de votre document" : "Verso de votre document"}
          </h2>
          <p className="text-slate-400 text-sm">
            Placez votre {docConfig?.label.toLowerCase()} dans le cadre
          </p>
        </div>

        {/* Tips */}
        <div className="flex justify-center gap-8">
          {tips.map((tip) => (
            <div key={tip.label} className="flex flex-col items-center gap-1.5">
              <tip.icon className="w-5 h-5 text-slate-400" />
              <span className="text-xs text-slate-500">{tip.label}</span>
            </div>
          ))}
        </div>

        {/* Bouton capture */}
        <div className="flex justify-center pt-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleCapture}
            disabled={!cameraReady || capturing}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center disabled:opacity-50 shadow-lg shadow-white/20 active:shadow-sm transition-shadow"
          >
            {capturing ? (
              <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
            ) : (
              <div className="w-16 h-16 rounded-full border-4 border-slate-200" />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

