/**
 * API Route: Threads de l'Assistant
 * SOTA Décembre 2025 - GPT-5.1 + LangGraph
 * 
 * GET /api/assistant/threads - Liste les conversations
 * POST /api/assistant/threads - Crée une nouvelle conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assistantService } from "@/features/assistant/services/assistant.service";
import { z } from "zod";

// ============================================
// GET - Lister les conversations
// ============================================

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }
    
    const threads = await assistantService.listThreads(profile.id);
    
    return NextResponse.json({
      success: true,
      threads,
    });
    
  } catch (error) {
    console.error("[API Assistant Threads] Error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Créer une conversation
// ============================================

const createThreadSchema = z.object({
  title: z.string().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }
    
    // Parser le body (peut être vide)
    let title: string | undefined;
    try {
      const body = await request.json();
      const validation = createThreadSchema.safeParse(body);
      if (validation.success) {
        title = validation.data.title;
      }
    } catch {
      // Body vide ou invalide, on continue sans titre
    }
    
    const thread = await assistantService.createThread(
      profile.id,
      user.id,
      title
    );
    
    if (!thread) {
      return NextResponse.json(
        { error: "Impossible de créer la conversation" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      thread,
    }, { status: 201 });
    
  } catch (error) {
    console.error("[API Assistant Threads] Error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

