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
  Scan,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

// Interface pour les données extraites
interface ExtractedIdData {
  nom?: string;
  prenom?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  sexe?: string;
  nationalite?: string;
  numeroCni?: string;
  dateExpiration?: string;
  confidence: number;
}

export function CNIScanner({ token, side, onSuccess, onSkip }: CNIScannerProps) {
  const [mode, setMode] = useState<"choose" | "camera" | "preview" | "analyzing" | "uploading">("choose");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  
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
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      
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
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      
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

    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image (JPG, PNG)");
      return;
    }

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

  /**
   * Charge Tesseract.js via CDN si non disponible
   */
  const loadTesseractFromCDN = useCallback(async (): Promise<any> => {
    // Vérifier si déjà chargé
    if (typeof window !== "undefined" && (window as any).Tesseract) {
      return (window as any).Tesseract;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;
      script.onload = () => {
        if ((window as any).Tesseract) {
          resolve((window as any).Tesseract);
        } else {
          reject(new Error("Tesseract non chargé"));
        }
      };
      script.onerror = () => reject(new Error("Erreur chargement CDN"));
      document.head.appendChild(script);
    });
  }, []);

  /**
   * Analyse OCR côté client avec Tesseract.js
   * Charge via CDN si l'import dynamique échoue
   */
  const performClientOCR = useCallback(async (imageUrl: string): Promise<ExtractedIdData> => {
    setOcrStatus("Préparation de l'analyse...");
    setOcrProgress(10);

    try {
      let Tesseract: any;

      // Essayer d'abord l'import dynamique
      try {
        setOcrStatus("Chargement du moteur OCR...");
        setOcrProgress(15);
        const tesseractModule = await import("tesseract.js");
        Tesseract = tesseractModule;
      } catch (importError) {
        // Fallback : charger via CDN
        console.log("[OCR] Import dynamique échoué, chargement CDN...");
        setOcrStatus("Chargement OCR (CDN)...");
        setOcrProgress(20);
        Tesseract = await loadTesseractFromCDN();
      }

      if (!Tesseract || !Tesseract.createWorker) {
        console.warn("[OCR] createWorker non disponible");
        return { confidence: 0 };
      }

      setOcrStatus("Initialisation...");
      setOcrProgress(30);
      
      // Créer un worker Tesseract
      const worker = await Tesseract.createWorker("fra", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setOcrProgress(30 + Math.round((m.progress || 0) * 60));
          }
        },
      });

      setOcrStatus("Analyse de l'image...");

      // Reconnaissance
      const result = await worker.recognize(imageUrl);
      
      // Terminer le worker
      await worker.terminate();

      setOcrStatus("Extraction des informations...");
      setOcrProgress(95);

      const text = result.data.text;
      const confidence = result.data.confidence / 100;

      console.log("[OCR Client] Texte extrait:", text.substring(0, 200));
      console.log("[OCR Client] Confiance:", confidence);

      // Extraire les champs depuis le texte
      const extractedData = extractFieldsFromText(text, confidence);

      setOcrProgress(100);
      return extractedData;

    } catch (error: any) {
      // Gestion des erreurs
      console.error("[OCR Client] Erreur:", error?.message || error);
      setOcrStatus("OCR non disponible");
      return { confidence: 0 };
    }
  }, [loadTesseractFromCDN]);

  /**
   * Extraire les champs depuis le texte OCR
   */
  const extractFieldsFromText = (text: string, confidence: number): ExtractedIdData => {
    const result: ExtractedIdData = { confidence };
    const normalizedText = text.toUpperCase().replace(/\s+/g, " ");

    console.log("[OCR] Extraction depuis texte normalisé...");

    // ==== NOM ====
    const nomPatterns = [
      /NOM\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,30})/,
      /SURNAME\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,30})/,
      /(?:^|\n)([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]{2,20})(?:\s|$)/m, // Nom en majuscules seul sur une ligne
    ];
    
    for (const pattern of nomPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        const nom = cleanName(match[1]);
        if (nom.length >= 2 && !["CARTE", "NATIONALE", "IDENTITE", "IDENTITY", "CARD", "REPUBLIQUE", "FRANCAISE"].includes(nom)) {
          result.nom = nom;
          break;
        }
      }
    }

    // ==== PRÉNOM ====
    const prenomPatterns = [
      /PR[EÉ]NOM[S]?\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s,]{2,50})/,
      /GIVEN\s*NAME[S]?\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s,]{2,50})/,
      /FIRST\s*NAME[S]?\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s,]{2,50})/,
    ];
    
    for (const pattern of prenomPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        result.prenom = cleanName(match[1]);
        break;
      }
    }

    // ==== DATE DE NAISSANCE ====
    const datePatterns = [
      /N[EÉ]\(?E?\)?\s*LE\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /DATE\s*(?:DE\s*)?NAISSANCE\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /BORN\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /(\d{2}[\.\/-]\d{2}[\.\/-](?:19|20)\d{2})/,
    ];
    
    for (const pattern of datePatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        result.dateNaissance = formatDate(match[1]);
        break;
      }
    }

    // ==== LIEU DE NAISSANCE ====
    const lieuPatterns = [
      /[AÀ]\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,40})\s*(?:\(|\d)/,
      /LIEU\s*(?:DE\s*)?NAISSANCE\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,40})/,
      /BIRTH\s*PLACE\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,40})/,
    ];
    
    for (const pattern of lieuPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        const lieu = cleanName(match[1]);
        if (lieu.length >= 2) {
          result.lieuNaissance = lieu;
          break;
        }
      }
    }

    // ==== SEXE ====
    if (/\bSEXE\s*[:\-]?\s*M\b|\bMASCULIN\b|\bMALE\b/i.test(normalizedText)) {
      result.sexe = "M";
    } else if (/\bSEXE\s*[:\-]?\s*F\b|\bF[EÉ]MININ\b|\bFEMALE\b/i.test(normalizedText)) {
      result.sexe = "F";
    }

    // ==== NATIONALITÉ ====
    if (/FRAN[CÇ]AISE|FRENCH|FRA\b/i.test(normalizedText)) {
      result.nationalite = "Française";
    }

    // ==== NUMÉRO CNI ====
    const numPatterns = [
      /N[°O]?\s*(?:DE\s*)?(?:CARTE|CNI|ID)\s*[:\-]?\s*([A-Z0-9]{9,14})/,
      /\b([A-Z]{2}\d{7}[A-Z0-9]{3})\b/,
      /\b(\d{12})\b/,
    ];
    
    for (const pattern of numPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1] && match[1].length >= 9) {
        result.numeroCni = match[1];
        break;
      }
    }

    // ==== DATE D'EXPIRATION ====
    const expiryPatterns = [
      /VALABLE\s*JUSQU['\s]?AU\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /VALID\s*UNTIL\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      /EXPIR[EY]\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
    ];
    
    for (const pattern of expiryPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        result.dateExpiration = formatDate(match[1]);
        break;
      }
    }

    // Log résultat
    const fieldsFound = Object.keys(result).filter(k => k !== "confidence" && result[k as keyof ExtractedIdData]);
    console.log(`[OCR] ${fieldsFound.length} champs extraits:`, fieldsFound.join(", "));

    return result;
  };

  // Nettoyer un nom
  const cleanName = (name: string): string => {
    return name
      .replace(/[^A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 4)
      .join(" ");
  };

  // Formater une date
  const formatDate = (dateStr: string): string => {
    const parts = dateStr.split(/[\.\/-]/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }
    return dateStr;
  };

  // Soumettre l'image avec OCR (optionnel)
  const submitImage = useCallback(async () => {
    if (!capturedFile || !capturedImage) return;

    setMode("analyzing");
    setError(null);
    setOcrProgress(0);

    let extractedData: ExtractedIdData = { confidence: 0 };

    try {
      // 1. Tentative d'analyse OCR côté client (pour le recto uniquement)
      if (side === "recto") {
        try {
          extractedData = await performClientOCR(capturedImage);
        } catch (ocrError) {
          console.warn("[CNI] OCR échoué, envoi sans extraction:", ocrError);
          // Continuer sans OCR
        }
      }

      setOcrStatus("Envoi au serveur...");

      // 2. Upload vers le serveur avec les données OCR
      const formData = new FormData();
      formData.append("file", capturedFile);
      formData.append("side", side);
      
      // Envoyer les données OCR au serveur pour stockage
      if (side === "recto" && extractedData.confidence > 0) {
        formData.append("ocr_data", JSON.stringify({
          nom: extractedData.nom,
          prenom: extractedData.prenom,
          date_naissance: extractedData.dateNaissance,
          lieu_naissance: extractedData.lieuNaissance,
          sexe: extractedData.sexe,
          nationalite: extractedData.nationalite,
          numero_cni: extractedData.numeroCni,
          date_expiration: extractedData.dateExpiration,
          ocr_confidence: extractedData.confidence,
        }));
      }

      const response = await fetch(`/api/signature/${token}/upload-cni`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'upload");
      }

      const result = await response.json();
      
      // 3. Fusionner les données OCR avec le résultat serveur
      const finalResult = {
        ...result,
        extracted_data: {
          ...result.extracted_data,
          // Données OCR extraites côté client
          nom: extractedData.nom,
          prenom: extractedData.prenom,
          date_naissance: extractedData.dateNaissance,
          lieu_naissance: extractedData.lieuNaissance,
          sexe: extractedData.sexe,
          nationalite: extractedData.nationalite,
          numero_cni: extractedData.numeroCni,
          date_expiration: extractedData.dateExpiration,
          ocr_confidence: extractedData.confidence,
          ocr_client: true,
        },
      };

      onSuccess(finalResult);
      
    } catch (err: any) {
      console.error("Erreur:", err);
      setError(err.message || "Erreur lors de l'analyse");
      setMode("preview");
    }
  }, [capturedFile, capturedImage, side, token, onSuccess, performClientOCR]);

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
                  <Scan className="h-4 w-4" />
                  Analyser
                </Button>
              </div>
            </motion.div>
          )}

          {/* Mode analyse OCR */}
          {mode === "analyzing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 p-6"
            >
              <div className="relative">
                <Scan className="h-16 w-16 text-blue-400 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                </div>
              </div>
              <div className="text-center space-y-2 w-full max-w-xs">
                <p className="text-white font-medium">{ocrStatus || "Analyse en cours..."}</p>
                <Progress value={ocrProgress} className="h-2" />
                <p className="text-white/60 text-sm">{ocrProgress}%</p>
              </div>
            </motion.div>
          )}

          {/* Mode upload (fallback) */}
          {mode === "uploading" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900"
            >
              <Loader2 className="h-12 w-12 text-white animate-spin" />
              <p className="text-white">Envoi en cours...</p>
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
