/**
 * API Route: Messages d'une conversation
 * SOTA Décembre 2025 - GPT-5.1 + LangGraph
 * 
 * GET /api/assistant/threads/[threadId]/messages - Liste les messages
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assistantService } from "@/features/assistant/services/assistant.service";

// ============================================
// GET - Lister les messages d'un thread
// ============================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    
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
    
    const messages = await assistantService.getThreadMessages(
      threadId,
      profile.id
    );
    
    return NextResponse.json({
      success: true,
      messages,
    });
    
  } catch (error) {
    console.error("[API Assistant Messages] Error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}

