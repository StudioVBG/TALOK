"use client";

/**
 * Composant d'enregistrement vocal AI
 * SOTA 2026 - Voice input pour tickets et assistant
 */

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Mic,
  MicOff,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface AIVoiceRecorderProps {
  onTranscription: (text: string) => void;
  onError?: (error: string) => void;
  maxDuration?: number; // En secondes
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

type RecordingState = "idle" | "recording" | "processing" | "success" | "error";

// ============================================
// COMPONENT
// ============================================

export function AIVoiceRecorder({
  onTranscription,
  onError,
  maxDuration = 60,
  className,
  disabled = false,
  placeholder = "Maintenez pour parler...",
}: AIVoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Démarre l'enregistrement
   */
  const startRecording = useCallback(async () => {
    if (disabled) return;

    try {
      // Demander l'accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Créer le MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Arrêter le stream
        stream.getTracks().forEach((track) => track.stop());

        // Créer le blob audio
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Transcrire
        await transcribeAudio(audioBlob);
      };

      // Démarrer l'enregistrement
      mediaRecorder.start(100);
      setState("recording");
      setDuration(0);
      setErrorMessage(null);

      // Timer pour la durée
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d >= maxDuration) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch (error: unknown) {
      console.error("[VoiceRecorder] Error starting:", error);
      setErrorMessage(
        error.name === "NotAllowedError"
          ? "Accès au microphone refusé"
          : "Erreur d'accès au microphone"
      );
      setState("error");
      onError?.(error.message);
    }
  }, [disabled, maxDuration, onError]);

  /**
   * Arrête l'enregistrement
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
      setState("processing");

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [state]);

  /**
   * Transcrit l'audio via l'API
   */
  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur de transcription");
      }

      const data = await response.json();

      if (data.text) {
        setState("success");
        onTranscription(data.text);

        // Reset après succès
        setTimeout(() => {
          setState("idle");
          setDuration(0);
        }, 1500);
      } else {
        throw new Error("Transcription vide");
      }
    } catch (error: unknown) {
      console.error("[VoiceRecorder] Transcription error:", error);
      setErrorMessage(error.message);
      setState("error");
      onError?.(error.message);

      // Reset après erreur
      setTimeout(() => {
        setState("idle");
        setErrorMessage(null);
      }, 3000);
    }
  };

  /**
   * Annule l'enregistrement
   */
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
      chunksRef.current = [];

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      setState("idle");
      setDuration(0);
    }
  }, [state]);

  // Formater la durée
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Bouton principal */}
      <motion.div
        className="relative"
        whileTap={{ scale: 0.95 }}
      >
        <Button
          type="button"
          size="lg"
          variant={state === "recording" ? "destructive" : "outline"}
          className={cn(
            "h-16 w-16 rounded-full transition-all",
            state === "recording" && "animate-pulse"
          )}
          disabled={disabled || state === "processing"}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={state === "recording" ? cancelRecording : undefined}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
        >
          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.div
                key="mic"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Mic className="h-6 w-6" />
              </motion.div>
            )}
            {state === "recording" && (
              <motion.div
                key="recording"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Square className="h-6 w-6" />
              </motion.div>
            )}
            {state === "processing" && (
              <motion.div
                key="processing"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Loader2 className="h-6 w-6 animate-spin" />
              </motion.div>
            )}
            {state === "success" && (
              <motion.div
                key="success"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <CheckCircle className="h-6 w-6 text-green-500" />
              </motion.div>
            )}
            {state === "error" && (
              <motion.div
                key="error"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <AlertCircle className="h-6 w-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>

        {/* Indicateur visuel de niveau audio */}
        {state === "recording" && (
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-red-500/50"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
      </motion.div>

      {/* Durée et progress */}
      {state === "recording" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-2 w-full max-w-[200px]"
        >
          <span className="text-lg font-mono">{formatDuration(duration)}</span>
          <Progress value={(duration / maxDuration) * 100} className="h-1" />
          <span className="text-xs text-muted-foreground">
            Max {formatDuration(maxDuration)}
          </span>
        </motion.div>
      )}

      {/* Message d'état */}
      <AnimatePresence>
        {state === "idle" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-muted-foreground text-center"
          >
            {placeholder}
          </motion.p>
        )}
        {state === "processing" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-muted-foreground"
          >
            Transcription en cours...
          </motion.p>
        )}
        {state === "success" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-green-600"
          >
            Transcription réussie !
          </motion.p>
        )}
        {state === "error" && errorMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-destructive text-center"
          >
            {errorMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AIVoiceRecorder;

