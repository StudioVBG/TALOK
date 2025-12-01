"use client";
// @ts-nocheck

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Upload,
  RotateCcw,
  Check,
  X,
  Loader2,
  CreditCard,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CNIScannerProps {
  token: string;
  side: "recto" | "verso";
  onSuccess: (data: {
    file_path: string;
    extracted_data: Record<string, any>;
  }) => void;
  onSkip?: () => void;
}

export function CNIScanner({ token, side, onSuccess, onSkip }: CNIScannerProps) {
  const [mode, setMode] = useState<"choose" | "camera" | "preview" | "uploading">("choose");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Attacher le stream quand le mode camera est actif et la vidéo est rendue
  useEffect(() => {
    if (mode === "camera" && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      
      video.onloadedmetadata = () => {
        video.play()
          .then(() => setCameraReady(true))
          .catch((err) => {
            console.error("Erreur lecture vidéo:", err);
            setError("Impossible de démarrer la vidéo.");
          });
      };
    }
  }, [mode]);

  // Nettoyer à la destruction du composant
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Démarrer la caméra
  const startCamera = useCallback(async () => {
    setError(null);
    setCameraReady(false);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Caméra arrière sur mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      
      // Stocker le stream et passer en mode caméra
      streamRef.current = stream;
      setMode("camera");
      
    } catch (err: any) {
      console.error("Erreur accès caméra:", err);
      
      if (err.name === "NotAllowedError") {
        setError("Accès à la caméra refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur.");
      } else if (err.name === "NotFoundError") {
        setError("Aucune caméra détectée. Utilisez l'option 'Importer' pour charger une photo.");
      } else {
        setError("Impossible d'accéder à la caméra. Veuillez utiliser l'option 'Importer'.");
      }
    }
  }, []);

  // Arrêter la caméra
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // Prendre une photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Définir la taille du canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Dessiner l'image
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      
      // Convertir en blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `cni_${side}.jpg`, { type: "image/jpeg" });
          setCapturedFile(file);
          setCapturedImage(canvas.toDataURL("image/jpeg"));
          setMode("preview");
          stopCamera();
        }
      }, "image/jpeg", 0.9);
    }
  }, [side, stopCamera]);

  // Gérer l'upload de fichier
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image (JPG, PNG)");
      return;
    }

    // Vérifier la taille (max 10 Mo)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image trop volumineuse (max 10 Mo)");
      return;
    }

    setCapturedFile(file);
    setCapturedImage(URL.createObjectURL(file));
    setMode("preview");
  }, []);

  // Reprendre la photo
  const retake = useCallback(() => {
    setCapturedImage(null);
    setCapturedFile(null);
    setMode("choose");
  }, []);

  // Soumettre l'image
  const submitImage = useCallback(async () => {
    if (!capturedFile) return;

    setMode("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", capturedFile);
      formData.append("side", side);

      const response = await fetch(`/api/signature/${token}/upload-cni`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'upload");
      }

      const result = await response.json();
      onSuccess(result);
    } catch (err: any) {
      console.error("Erreur upload CNI:", err);
      setError(err.message || "Erreur lors de l'envoi");
      setMode("preview");
    }
  }, [capturedFile, side, token, onSuccess]);

  return (
    <div className="space-y-4">
      {/* Titre */}
      <div className="text-center">
        <h3 className="font-semibold text-lg">
          {side === "recto" ? "Recto de votre CNI" : "Verso de votre CNI"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {side === "recto" 
            ? "Prenez en photo le côté avec votre photo"
            : "Prenez en photo le côté avec le numéro"}
        </p>
      </div>

      {/* Erreur */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Zone de capture/aperçu */}
      <div className="relative aspect-[3/2] rounded-xl overflow-hidden bg-slate-900 border-2 border-slate-200 dark:border-slate-700">
        <AnimatePresence mode="wait">
          {/* Mode choix */}
          {mode === "choose" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6"
            >
              <div className="p-4 bg-white/10 rounded-2xl">
                <CreditCard className="h-12 w-12 text-white/60" />
              </div>
              <p className="text-white/60 text-sm text-center">
                Positionnez votre carte d'identité dans le cadre
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={startCamera}
                  className="gap-2 bg-white text-slate-900 hover:bg-white/90"
                >
                  <Camera className="h-4 w-4" />
                  Prendre une photo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 border-white/30 text-white hover:bg-white/10"
                >
                  <Upload className="h-4 w-4" />
                  Importer
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </motion.div>
          )}

          {/* Mode caméra */}
          {mode === "camera" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* Indicateur de chargement de la caméra */}
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                  <div className="text-center">
                    <Loader2 className="h-10 w-10 text-white animate-spin mx-auto mb-3" />
                    <p className="text-white text-sm">Démarrage de la caméra...</p>
                  </div>
                </div>
              )}
              
              {/* Guide de cadrage */}
              <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
              </div>

              {/* Boutons - visibles seulement quand la caméra est prête */}
              {cameraReady && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      stopCamera();
                      setCameraReady(false);
                      setMode("choose");
                    }}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <Button
                    onClick={capturePhoto}
                    size="lg"
                    className="w-16 h-16 rounded-full bg-white text-slate-900 hover:bg-white/90 shadow-lg"
                  >
                    <Camera className="h-8 w-8" />
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* Mode aperçu */}
          {mode === "preview" && capturedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <img
                src={capturedImage}
                alt="Aperçu CNI"
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* Overlay avec actions */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={retake}
                  className="gap-2 bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reprendre
                </Button>
                <Button
                  onClick={submitImage}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4" />
                  Valider
                </Button>
              </div>
            </motion.div>
          )}

          {/* Mode upload */}
          {mode === "uploading" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900"
            >
              <Loader2 className="h-12 w-12 text-white animate-spin" />
              <p className="text-white">Analyse en cours...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas caché pour la capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Option passer */}
      {side === "verso" && onSkip && (
        <Button
          variant="ghost"
          onClick={onSkip}
          className="w-full gap-2 text-muted-foreground"
        >
          Passer cette étape
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

