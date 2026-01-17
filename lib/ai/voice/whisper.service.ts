/**
 * Service Whisper - Transcription vocale
 * SOTA 2026 - Voice-to-Text pour tickets et assistant
 * 
 * Utilise OpenAI Whisper pour transcrire les enregistrements vocaux
 * Cas d'usage : création de tickets vocaux, commandes vocales
 */

import OpenAI from "openai";

// ============================================
// TYPES
// ============================================

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  confidence?: number;
}

export interface TranscriptionOptions {
  language?: string; // Force la langue (ex: "fr")
  prompt?: string; // Contexte pour améliorer la transcription
  temperature?: number; // 0-1, plus bas = plus déterministe
}

// ============================================
// SERVICE
// ============================================

class WhisperService {
  private client: OpenAI | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn("[Whisper] OPENAI_API_KEY non configurée");
      return;
    }

    this.client = new OpenAI({ apiKey });
  }

  /**
   * Transcrit un fichier audio
   * @param audioFile - Fichier audio (File, Blob, ou Buffer)
   * @param options - Options de transcription
   */
  async transcribe(
    audioFile: File | Blob | Buffer,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    if (!this.client) {
      throw new Error("Whisper non configuré - clé API OpenAI manquante");
    }

    // Convertir en File si nécessaire
    let file: File;

    if (audioFile instanceof Buffer) {
      file = new File([audioFile], "audio.webm", { type: "audio/webm" });
    } else if (audioFile instanceof Blob && !(audioFile instanceof File)) {
      file = new File([audioFile], "audio.webm", { type: audioFile.type });
    } else {
      file = audioFile as File;
    }

    console.log(`[Whisper] Transcribing ${file.name} (${file.size} bytes)`);

    const startTime = Date.now();

    try {
      const response = await this.client.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: options?.language || "fr",
        prompt: options?.prompt,
        temperature: options?.temperature || 0,
        response_format: "verbose_json",
      });

      const duration = Date.now() - startTime;

      console.log(`[Whisper] Transcription completed in ${duration}ms`);

      return {
        text: response.text,
        language: response.language || "fr",
        duration: response.duration || 0,
        confidence: undefined, // Whisper ne retourne pas de score de confiance
      };
    } catch (error: unknown) {
      console.error("[Whisper] Transcription error:", error.message);
      throw new Error(`Erreur de transcription: ${error.message}`);
    }
  }

  /**
   * Transcrit un fichier audio depuis une URL
   */
  async transcribeFromUrl(
    audioUrl: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    console.log(`[Whisper] Fetching audio from URL: ${audioUrl}`);

    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const blob = await response.blob();
    return this.transcribe(blob, options);
  }

  /**
   * Transcrit un enregistrement base64
   */
  async transcribeBase64(
    base64Audio: string,
    mimeType: string = "audio/webm",
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    // Retirer le préfixe data URL si présent
    const base64Data = base64Audio.replace(/^data:audio\/\w+;base64,/, "");

    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer], { type: mimeType });

    return this.transcribe(blob, options);
  }

  /**
   * Vérifie si le service est disponible
   */
  isAvailable(): boolean {
    return this.client !== null;
  }
}

// Singleton
export const whisperService = new WhisperService();

export default whisperService;

