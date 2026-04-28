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
  Sun,
  Focus,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { quickQualityCheck, analyzeImageQuality, type ImageQualityIssue } from "@/lib/helpers/image-quality";

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.log(...args);
};

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
  
  // État pour les problèmes de qualité d'image
  const [qualityIssues, setQualityIssues] = useState<ImageQualityIssue[]>([]);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [checkingQuality, setCheckingQuality] = useState(false);
  
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

  // Prendre une photo avec vérification de qualité
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      
      // Vérification de qualité avant de valider la capture
      setCheckingQuality(true);
      setQualityIssues([]);
      setQualityScore(null);
      
      try {
        const qualityResult = await analyzeImageQuality(imageDataUrl, {
          minWidth: 640,
          minHeight: 480,
          checkBlur: true,
          checkBrightness: true,
        });
        
        setQualityScore(qualityResult.score);
        setQualityIssues(qualityResult.issues);
        
        // Si qualité insuffisante (erreurs critiques), avertir mais laisser continuer
        const hasErrors = qualityResult.issues.some(i => i.severity === "error");
        if (hasErrors) {
          console.warn("[CNI] Qualité d'image insuffisante:", qualityResult.issues);
          setError(qualityResult.suggestions[0] || "Qualité d'image insuffisante");
        } else {
          setError(null);
        }
        
        // Créer le fichier et passer en preview dans tous les cas
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `cni_${side}.jpg`, { type: "image/jpeg" });
            setCapturedFile(file);
            setCapturedImage(imageDataUrl);
            setMode("preview");
            stopCamera();
          }
        }, "image/jpeg", 0.9);
        
      } catch (qualityError) {
        console.warn("[CNI] Erreur vérification qualité:", qualityError);
        // Continuer même si la vérification échoue
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `cni_${side}.jpg`, { type: "image/jpeg" });
            setCapturedFile(file);
            setCapturedImage(imageDataUrl);
            setMode("preview");
            stopCamera();
          }
        }, "image/jpeg", 0.9);
      } finally {
        setCheckingQuality(false);
      }
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
   * 
   * Gère plusieurs cas d'erreur :
   * - Module Tesseract non disponible
   * - Worker qui ne se crée pas
   * - Timeout de reconnaissance
   * - Erreurs réseau pour le CDN
   */
  const performClientOCR = useCallback(async (imageUrl: string): Promise<ExtractedIdData> => {
    setOcrStatus("Préparation de l'analyse...");
    setOcrProgress(10);
    
    const startTime = Date.now();
    const TIMEOUT_MS = 30000; // 30 secondes max

    try {
      let Tesseract: any;
      let loadMethod = "unknown";

      // Essayer d'abord l'import dynamique (plus rapide si déjà bundlé)
      try {
        setOcrStatus("Chargement du moteur OCR...");
        setOcrProgress(15);
        const tesseractModule = await import("tesseract.js");
        Tesseract = tesseractModule;
        loadMethod = "import";
        devLog("[OCR] Module Tesseract chargé via import dynamique");
      } catch (importError: any) {
        // Fallback : charger via CDN
        devLog("[OCR] Import dynamique échoué:", importError?.message);
        setOcrStatus("Chargement OCR (CDN)...");
        setOcrProgress(20);
        
        try {
          Tesseract = await Promise.race([
            loadTesseractFromCDN(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Timeout chargement CDN")), 10000)
            ),
          ]);
          loadMethod = "cdn";
          devLog("[OCR] Module Tesseract chargé via CDN");
        } catch (cdnError: any) {
          console.error("[OCR] Échec chargement CDN:", cdnError?.message);
          throw new Error(`OCR non disponible: ${cdnError?.message || "Impossible de charger le moteur OCR"}`);
        }
      }

      // Vérifier que createWorker est disponible
      const createWorkerFn = Tesseract?.createWorker || Tesseract?.default?.createWorker;
      if (!createWorkerFn) {
        console.error("[OCR] createWorker non trouvé dans le module:", Object.keys(Tesseract || {}));
        throw new Error("Moteur OCR incompatible (createWorker non disponible)");
      }

      setOcrStatus("Initialisation du moteur...");
      setOcrProgress(30);
      
      // Créer un worker Tesseract avec gestion du timeout
      let worker: any;
      try {
        worker = await Promise.race([
          createWorkerFn("fra", 1, {
            logger: (m: any) => {
              if (m.status === "recognizing text") {
                const progress = 30 + Math.round((m.progress || 0) * 55);
                setOcrProgress(progress);
              } else if (m.status === "loading language traineddata") {
                setOcrStatus("Chargement des données linguistiques...");
              }
            },
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout initialisation OCR")), 15000)
          ),
        ]);
      } catch (workerError: any) {
        console.error("[OCR] Erreur création worker:", workerError?.message);
        throw new Error(`Échec initialisation OCR: ${workerError?.message}`);
      }

      setOcrStatus("Analyse du document...");

      // Reconnaissance avec timeout
      let result: any;
      try {
        const remainingTime = TIMEOUT_MS - (Date.now() - startTime);
        result = await Promise.race([
          worker.recognize(imageUrl),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout analyse OCR")), Math.max(remainingTime, 5000))
          ),
        ]);
      } catch (recognizeError: any) {
        await worker.terminate().catch(() => {}); // Cleanup silencieux
        throw new Error(`Échec analyse: ${recognizeError?.message}`);
      }
      
      // Terminer le worker proprement
      try {
        await worker.terminate();
      } catch (e) {
        console.warn("[OCR] Erreur terminaison worker (ignorée):", e);
      }

      setOcrStatus("Extraction des informations...");
      setOcrProgress(90);

      const text = result?.data?.text || "";
      const confidence = (result?.data?.confidence || 0) / 100;
      
      const duration = Date.now() - startTime;
      devLog(`[OCR Client] Analyse terminée en ${duration}ms via ${loadMethod}`);
      devLog("[OCR Client] Confiance:", (confidence * 100).toFixed(1) + "%");
      devLog("[OCR Client] Texte extrait:", text.substring(0, 300) + (text.length > 300 ? "..." : ""));

      // Vérifier si on a obtenu du texte exploitable
      if (!text || text.trim().length < 10) {
        console.warn("[OCR Client] Texte extrait trop court ou vide");
        return { confidence: confidence > 0 ? confidence : 0.1 };
      }

      // Extraire les champs depuis le texte
      const extractedData = extractFieldsFromText(text, confidence);

      setOcrProgress(100);
      setOcrStatus("Analyse terminée");
      
      return extractedData;

    } catch (error: unknown) {
      // Gestion des erreurs avec message explicite
      const errorMsg = (error as any)?.message || String(error) || "Erreur inconnue";
      console.error("[OCR Client] Erreur:", errorMsg);
      setOcrStatus(`Échec: ${errorMsg.substring(0, 50)}`);
      
      // Retourner une erreur explicite au lieu de { confidence: 0 } silencieux
      throw new Error(`OCR échoué: ${errorMsg}`);
    }
  }, [loadTesseractFromCDN]);

  /**
   * Extraire les champs depuis le texte OCR
   * Gère à la fois le texte du recto (visuel) et du verso (MRZ)
   */
  const extractFieldsFromText = (text: string, confidence: number): ExtractedIdData => {
    const result: ExtractedIdData = { confidence };
    const normalizedText = text.toUpperCase().replace(/\s+/g, " ");
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    devLog("[OCR] Extraction depuis texte normalisé...");

    // ============================================
    // EXTRACTION MRZ (Machine Readable Zone) - PRIORITAIRE
    // La MRZ est plus fiable que le texte visuel
    // Format CNI française : 2 lignes de 36 caractères
    // ============================================
    const mrzLines = lines.filter(line => {
      const cleaned = line.replace(/\s/g, "").toUpperCase();
      // MRZ contient uniquement A-Z, 0-9 et <
      return /^[A-Z0-9<]{28,44}$/.test(cleaned);
    });

    if (mrzLines.length >= 2) {
      devLog("[OCR] MRZ détectée, extraction prioritaire...");
      const mrzData = extractFromMRZ(mrzLines.slice(-2).join("\n")); // Prendre les 2 dernières lignes
      
      // Utiliser les données MRZ si extraites avec succès
      if (mrzData.nom) result.nom = mrzData.nom;
      if (mrzData.prenom) result.prenom = mrzData.prenom;
      if (mrzData.dateNaissance) result.dateNaissance = mrzData.dateNaissance;
      if (mrzData.sexe) result.sexe = mrzData.sexe;
      if (mrzData.nationalite) result.nationalite = mrzData.nationalite;
      if (mrzData.numeroCni) result.numeroCni = mrzData.numeroCni;
      if (mrzData.dateExpiration) result.dateExpiration = mrzData.dateExpiration;
    }

    // ============================================
    // EXTRACTION TEXTE VISUEL (fallback ou complément)
    // ============================================

    // ==== NOM ====
    if (!result.nom) {
      const nomPatterns = [
        /NOM\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,30})/,
        /SURNAME\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒ\-\s]{2,30})/,
        /(?:^|\n)([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]{2,20})(?:\s|$)/m,
      ];
      
      for (const pattern of nomPatterns) {
        const match = normalizedText.match(pattern);
        if (match && match[1]) {
          const nom = cleanName(match[1]);
          const exclusions = ["CARTE", "NATIONALE", "IDENTITE", "IDENTITY", "CARD", "REPUBLIQUE", "FRANCAISE", "FRANCE", "IDFRA"];
          if (nom.length >= 2 && !exclusions.includes(nom)) {
            result.nom = nom;
            break;
          }
        }
      }
    }

    // ==== PRÉNOM ====
    if (!result.prenom) {
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
    }

    // ==== DATE DE NAISSANCE ====
    if (!result.dateNaissance) {
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
    }

    // ==== LIEU DE NAISSANCE ====
    if (!result.lieuNaissance) {
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
    }

    // ==== SEXE ====
    if (!result.sexe) {
      if (/\bSEXE\s*[:\-]?\s*M\b|\bMASCULIN\b|\bMALE\b/i.test(normalizedText)) {
        result.sexe = "M";
      } else if (/\bSEXE\s*[:\-]?\s*F\b|\bF[EÉ]MININ\b|\bFEMALE\b/i.test(normalizedText)) {
        result.sexe = "F";
      }
    }

    // ==== NATIONALITÉ ====
    if (!result.nationalite) {
      if (/FRAN[CÇ]AISE|FRENCH|FRA\b/i.test(normalizedText)) {
        result.nationalite = "Française";
      }
    }

    // ==== NUMÉRO CNI ====
    if (!result.numeroCni) {
      const numPatterns = [
        /N[°O]?\s*(?:DE\s*)?(?:CARTE|CNI|ID)\s*[:\-]?\s*([A-Z0-9]{9,14})/,
        /\b([A-Z]{2}\d{7}[A-Z0-9]{3})\b/, // Format CNI nouvelle génération
        /\b(\d{12})\b/, // Ancien format 12 chiffres
      ];
      
      for (const pattern of numPatterns) {
        const match = normalizedText.match(pattern);
        if (match && match[1] && match[1].length >= 9) {
          result.numeroCni = match[1];
          break;
        }
      }
    }

    // ==== DATE D'EXPIRATION ====
    if (!result.dateExpiration) {
      const expiryPatterns = [
        /VALABLE\s*JUSQU['\s]?AU\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
        /VALID\s*UNTIL\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
        /EXPIR[EY]\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
        /FIN\s*(?:DE\s*)?VALIDIT[EÉ]\s*[:\-]?\s*(\d{2}[\.\/-]\d{2}[\.\/-]\d{4})/i,
      ];
      
      for (const pattern of expiryPatterns) {
        const match = normalizedText.match(pattern);
        if (match && match[1]) {
          result.dateExpiration = formatDate(match[1]);
          break;
        }
      }
    }

    // Log résultat
    const fieldsFound = Object.keys(result).filter(k => k !== "confidence" && result[k as keyof ExtractedIdData]);
    devLog(`[OCR] ${fieldsFound.length} champs extraits:`, fieldsFound.join(", "));

    return result;
  };

  /**
   * Extraire les données depuis la zone MRZ de la CNI française
   * Format ID-2 : 2 lignes de 36 caractères
   * Ligne 1: IDFRA[NOM<PRENOM]
   * Ligne 2: [NUM_DOC(12)][CHECK][NAT][DDN(6)][CHECK][SEX][EXP(6)][CHECK][OPTIONNEL]
   */
  const extractFromMRZ = (mrz: string): Partial<ExtractedIdData> => {
    const result: Partial<ExtractedIdData> = {};
    
    // Normaliser la MRZ
    const cleaned = mrz.toUpperCase().replace(/[^A-Z0-9<\n]/g, "");
    const lines = cleaned.split("\n").filter(l => l.length >= 28);
    
    if (lines.length < 2) {
      devLog("[MRZ] Format non reconnu (moins de 2 lignes valides)");
      return result;
    }

    const line1 = lines[0].padEnd(36, "<");
    const line2 = lines[1].padEnd(36, "<");
    
    devLog("[MRZ] Ligne 1:", line1);
    devLog("[MRZ] Ligne 2:", line2);

    try {
      // Ligne 1 : Nom et prénom
      // Format: IDFRA[NOM<<PRENOM<<<...]
      if (line1.startsWith("ID") || line1.startsWith("I<")) {
        const namePart = line1.substring(5); // Après "IDFRA"
        const [lastName, firstNamePart] = namePart.split("<<");
        
        if (lastName) {
          result.nom = lastName.replace(/</g, " ").trim();
        }
        if (firstNamePart) {
          result.prenom = firstNamePart.replace(/</g, " ").trim().split(" ")[0];
        }
      }

      // Ligne 2 : Numéro, dates, sexe
      // Positions pour CNI française (36 caractères):
      // 0-11: Numéro de document
      // 12: Checksum numéro
      // 13-15: Nationalité
      // 16-21: Date de naissance (AAMMJJ)
      // 22: Checksum date naissance
      // 23: Sexe (M/F)
      // 24-29: Date d'expiration (AAMMJJ)
      // 30: Checksum date expiration
      
      // Numéro de document
      const docNum = line2.substring(0, 12).replace(/</g, "");
      if (docNum && docNum.length >= 9) {
        result.numeroCni = docNum;
      }

      // Nationalité
      const nat = line2.substring(13, 16).replace(/</g, "");
      if (nat === "FRA") {
        result.nationalite = "Française";
      }

      // Date de naissance (format AAMMJJ)
      const dobStr = line2.substring(16, 22);
      if (/^\d{6}$/.test(dobStr)) {
        result.dateNaissance = parseMRZDate(dobStr);
      }

      // Sexe
      const sex = line2[23];
      if (sex === "M" || sex === "F") {
        result.sexe = sex;
      }

      // Date d'expiration (format AAMMJJ)
      const expStr = line2.substring(24, 30);
      if (/^\d{6}$/.test(expStr)) {
        result.dateExpiration = parseMRZDate(expStr);
      }

      devLog("[MRZ] Données extraites:", result);
    } catch (err) {
      console.warn("[MRZ] Erreur extraction:", err);
    }

    return result;
  };

  /**
   * Convertir une date MRZ (AAMMJJ) en format ISO (YYYY-MM-DD)
   */
  const parseMRZDate = (mrzDate: string): string | undefined => {
    if (mrzDate.length !== 6 || !/^\d{6}$/.test(mrzDate)) {
      return undefined;
    }

    const yy = parseInt(mrzDate.substring(0, 2), 10);
    const mm = mrzDate.substring(2, 4);
    const dd = mrzDate.substring(4, 6);

    // Déterminer le siècle (heuristique : > 30 = 1900s, <= 30 = 2000s)
    const currentYear = new Date().getFullYear() % 100;
    const century = yy > currentYear + 10 ? 1900 : 2000;
    const year = century + yy;

    // Valider les valeurs
    const m = parseInt(mm, 10);
    const d = parseInt(dd, 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      return undefined;
    }

    return `${year}-${mm}-${dd}`;
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
    let ocrAttempted = false;
    let ocrError: string | null = null;

    try {
      // 1. Tentative d'analyse OCR côté client (pour recto ET verso)
      // Le verso contient souvent la MRZ qui est plus fiable
      try {
        setOcrStatus("Analyse du document...");
        extractedData = await performClientOCR(capturedImage);
        ocrAttempted = true;
        
        // Log le résultat pour debug
        devLog(`[CNI ${side}] OCR résultat:`, {
          confidence: extractedData.confidence,
          nom: extractedData.nom,
          prenom: extractedData.prenom,
          numeroCni: extractedData.numeroCni,
        });
        
        // Avertir si confiance faible
        if (extractedData.confidence > 0 && extractedData.confidence < 0.5) {
          console.warn(`[CNI ${side}] Confiance OCR faible: ${(extractedData.confidence * 100).toFixed(1)}%`);
        }
      } catch (ocrErr: any) {
        console.warn(`[CNI ${side}] OCR échoué:`, ocrErr?.message || ocrErr);
        ocrError = ocrErr?.message || "Échec de l'analyse OCR";
        ocrAttempted = true;
        // Continuer sans OCR - le serveur peut faire une analyse de secours
      }

      setOcrStatus("Envoi au serveur...");
      setOcrProgress(90);

      // 2. Upload vers le serveur avec les données OCR
      const formData = new FormData();
      formData.append("file", capturedFile);
      formData.append("side", side);
      
      // Toujours envoyer les données OCR si disponibles (recto ET verso)
      // Le verso peut contenir la MRZ avec le numéro CNI et date d'expiration
      if (extractedData.confidence > 0) {
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
      
      // Signaler si l'OCR client a échoué pour que le serveur fasse un fallback
      formData.append("ocr_attempted", String(ocrAttempted));
      if (ocrError) {
        formData.append("ocr_client_error", ocrError);
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
      setOcrProgress(100);
      
      // 3. Fusionner les données OCR client avec le résultat serveur
      // Prioriser les données serveur si disponibles (plus fiables)
      const serverData = result.extracted_data || {};
      const finalResult = {
        ...result,
        extracted_data: {
          // D'abord les données serveur (OCR serveur si fait)
          ...serverData,
          // Ensuite les données client si pas de données serveur
          nom: serverData.nom || extractedData.nom,
          prenom: serverData.prenom || extractedData.prenom,
          date_naissance: serverData.date_naissance || extractedData.dateNaissance,
          lieu_naissance: serverData.lieu_naissance || extractedData.lieuNaissance,
          sexe: serverData.sexe || extractedData.sexe,
          nationalite: serverData.nationalite || extractedData.nationalite,
          numero_cni: serverData.numero_cni || extractedData.numeroCni,
          date_expiration: serverData.date_expiration || extractedData.dateExpiration,
          // Métadonnées OCR
          ocr_confidence: serverData.ocr_confidence || extractedData.confidence,
          ocr_source: serverData.ocr_source || (extractedData.confidence > 0 ? "client" : "none"),
        },
      };

      onSuccess(finalResult);
      
    } catch (err: any) {
      console.error(`[CNI ${side}] Erreur:`, err);
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
              
              {/* Indicateur de qualité d'image */}
              {qualityScore !== null && (
                <div className="absolute top-3 left-3 right-3">
                  <div className={cn(
                    "px-3 py-2 rounded-lg text-sm flex items-center gap-2",
                    qualityScore >= 70 
                      ? "bg-green-500/90 text-white" 
                      : qualityScore >= 50 
                        ? "bg-amber-500/90 text-white"
                        : "bg-red-500/90 text-white"
                  )}>
                    {qualityScore >= 70 ? (
                      <Check className="h-4 w-4" />
                    ) : qualityScore >= 50 ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span>
                      {qualityScore >= 70 
                        ? "Bonne qualité" 
                        : qualityScore >= 50 
                          ? "Qualité acceptable"
                          : "Qualité insuffisante"}
                    </span>
                    <span className="ml-auto font-mono">{qualityScore}%</span>
                  </div>
                  
                  {/* Afficher les problèmes détectés */}
                  {qualityIssues.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {qualityIssues.map((issue, idx) => (
                        <div 
                          key={idx}
                          className={cn(
                            "px-2 py-1 rounded text-xs flex items-center gap-1",
                            issue.severity === "error" 
                              ? "bg-red-500/80 text-white" 
                              : "bg-amber-500/80 text-white"
                          )}
                        >
                          {issue.type === "blur" && <Focus className="h-3 w-3" />}
                          {issue.type === "dark" && <Sun className="h-3 w-3" />}
                          {issue.type === "bright" && <Sun className="h-3 w-3" />}
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
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
                  disabled={qualityScore !== null && qualityScore < 30}
                  className={cn(
                    "gap-2",
                    qualityScore !== null && qualityScore < 50
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-green-600 hover:bg-green-700"
                  )}
                >
                  <Scan className="h-4 w-4" />
                  {qualityScore !== null && qualityScore < 50 ? "Continuer quand même" : "Analyser"}
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
