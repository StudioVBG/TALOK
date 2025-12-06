"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Loader2, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelfieCaptureProps {
  onCapture: (blob: Blob, preview: string) => void;
  onBack: () => void;
}

type LivenessInstruction =
  | "center"
  | "turn_left"
  | "turn_right"
  | "smile"
  | "complete";

const INSTRUCTIONS: Record<LivenessInstruction, string> = {
  center: "Placez votre visage au centre",
  turn_left: "Tournez lentement la tête à gauche",
  turn_right: "Tournez lentement la tête à droite",
  smile: "Souriez !",
  complete: "Parfait !",
};

export function SelfieCapture({ onCapture, onBack }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Liveness detection state
  const [instruction, setInstruction] = useState<LivenessInstruction>("center");
  const [progress, setProgress] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  const initCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
      setError("Impossible d'accéder à la caméra frontale.");
    }
  }, []);

  useEffect(() => {
    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [initCamera, stream]);

  // Simulation de la détection de vivacité (liveness)
  // Dans une vraie implémentation, utilisez une lib comme face-api.js ou un service externe
  useEffect(() => {
    if (!cameraReady || isCapturing) return;

    const sequence: LivenessInstruction[] = [
      "center",
      "turn_left",
      "turn_right",
      "smile",
      "complete",
    ];

    let currentIndex = 0;
    let stepProgress = 0;

    const interval = setInterval(() => {
      stepProgress += 5;
      setProgress(
        Math.min(
          ((currentIndex * 25) + (stepProgress / 100) * 25),
          100
        )
      );

      if (stepProgress >= 100) {
        stepProgress = 0;
        currentIndex++;

        if (currentIndex < sequence.length) {
          setInstruction(sequence[currentIndex]);
        }

        if (currentIndex >= sequence.length - 1) {
          clearInterval(interval);
          setIsCapturing(true);
          capturePhoto();
        }
      }
    }, 150);

    return () => clearInterval(interval);
  }, [cameraReady, isCapturing]);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Flip horizontal pour selfie
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
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

      // Petit délai pour l'animation
      setTimeout(() => {
        onCapture(blob, preview);
      }, 500);
    } catch (err) {
      console.error("Erreur capture selfie:", err);
      setError("Erreur lors de la capture. Veuillez réessayer.");
      setIsCapturing(false);
    }
  };

  const handleRetry = () => {
    setInstruction("center");
    setProgress(0);
    setIsCapturing(false);
    setError(null);
  };

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
          <span className="text-white/60 text-sm">Vérification du visage</span>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      {/* Zone caméra frontale */}
      <div className="flex-1 relative flex items-center justify-center">
        {error ? (
          <div className="text-center p-6">
            <p className="text-red-400 mb-4">{error}</p>
            <Button
              onClick={handleRetry}
              variant="outline"
              className="text-white border-white/30"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay avec cercle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50" />

              {/* Cercle de capture */}
              <div className="relative z-10">
                {/* Cercle principal transparent */}
                <div
                  className="w-64 h-64 md:w-72 md:h-72 rounded-full"
                  style={{
                    background: "transparent",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                  }}
                />

                {/* Cercle de progression SVG */}
                <svg
                  className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)]"
                  viewBox="0 0 100 100"
                >
                  {/* Cercle de fond */}
                  <circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="2"
                  />
                  {/* Cercle de progression */}
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 3.02} 302`}
                    transform="rotate(-90 50 50)"
                    initial={{ strokeDasharray: "0 302" }}
                    animate={{ strokeDasharray: `${progress * 3.02} 302` }}
                    transition={{ duration: 0.3 }}
                  />
                </svg>

                {/* Indicateurs directionnels pour liveness */}
                {instruction === "turn_left" && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14"
                  >
                    <ChevronLeft className="w-10 h-10 text-emerald-400 animate-pulse" />
                  </motion.div>
                )}

                {instruction === "turn_right" && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14"
                  >
                    <ChevronRight className="w-10 h-10 text-emerald-400 animate-pulse" />
                  </motion.div>
                )}

                {/* Animation de succès */}
                {instruction === "complete" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 rounded-full"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                      className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center"
                    >
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <motion.path
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ delay: 0.4, duration: 0.4 }}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Instructions dynamiques */}
      <div className="bg-gradient-to-t from-black via-black/95 to-transparent p-6 pt-8 space-y-4">
        <motion.div
          key={instruction}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-white text-xl font-semibold">
            {INSTRUCTIONS[instruction]}
          </p>
        </motion.div>

        {/* Barre de progression */}
        <div className="w-full max-w-xs mx-auto">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm">
          {isCapturing
            ? "Capture en cours..."
            : "Vérification de vivacité en cours..."}
        </p>
      </div>
    </div>
  );
}

