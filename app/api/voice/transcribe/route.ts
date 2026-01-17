/**
 * API Route: Transcription vocale avec Whisper
 * SOTA 2026 - Voice-to-Text
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { whisperService } from "@/lib/ai/voice/whisper.service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Authentification
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Vérifier que Whisper est disponible
    if (!whisperService.isAvailable()) {
      return NextResponse.json(
        { error: "Service de transcription non disponible" },
        { status: 503 }
      );
    }

    // Récupérer le fichier audio
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Fichier audio manquant" },
        { status: 400 }
      );
    }

    // Vérifier la taille (max 25 MB pour Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 25 MB)" },
        { status: 400 }
      );
    }

    // Vérifier le type MIME
    const validTypes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"];
    if (!validTypes.some((t) => audioFile.type.startsWith(t.split("/")[0]))) {
      return NextResponse.json(
        { error: "Format audio non supporté" },
        { status: 400 }
      );
    }

    console.log(`[Transcribe] Processing ${audioFile.name} (${audioFile.size} bytes)`);

    // Transcription
    const result = await whisperService.transcribe(audioFile, {
      language: "fr",
      prompt: "Transcription d'un message vocal concernant un bien immobilier, un locataire, un loyer ou une maintenance.",
    });

    console.log(`[Transcribe] Success: "${result.text.substring(0, 50)}..."`);

    return NextResponse.json({
      text: result.text,
      language: result.language,
      duration: result.duration,
    });
  } catch (error: unknown) {
    console.error("[Transcribe] Error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur de transcription" },
      { status: 500 }
    );
  }
}

