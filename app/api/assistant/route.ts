/**
 * API Route: Assistant IA
 * SOTA Décembre 2025 - GPT-5.1 + LangGraph
 * 
 * POST /api/assistant - Envoie un message à l'assistant
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assistantService } from "@/features/assistant/services/assistant.service";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMA
// ============================================

const sendMessageSchema = z.object({
  message: z.string().min(1, "Le message ne peut pas être vide").max(10000, "Message trop long"),
  threadId: z.string().uuid().optional(),
  context: z.object({
    currentPropertyId: z.string().uuid().optional(),
    currentLeaseId: z.string().uuid().optional(),
    currentTicketId: z.string().uuid().optional(),
  }).optional(),
});

// ============================================
// POST - Envoyer un message
// ============================================

export async function POST(request: NextRequest) {
  console.log("[API Assistant] POST request received");
  
  try {
    // Vérifier la configuration OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey || !openaiKey.startsWith('sk-')) {
      console.error("[API Assistant] OPENAI_API_KEY non configurée ou invalide");
      return NextResponse.json(
        { error: "L'assistant IA n'est pas configuré. La clé OpenAI est manquante." },
        { status: 503 }
      );
    }
    console.log("[API Assistant] OpenAI key configured ✓");
    
    // Authentification
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error("[API Assistant] Auth error:", authError.message);
    }
    
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }
    console.log("[API Assistant] User authenticated:", user.id);
    
    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    
    if (profileError) {
      console.error("[API Assistant] Profile error:", profileError.message);
    }
    
    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }
    console.log("[API Assistant] Profile found:", profile.id, profile.role);
    
    // Parser et valider le body
    const body = await request.json();
    console.log("[API Assistant] Request body:", { message: body.message?.substring(0, 50), threadId: body.threadId });
    
    const validation = sendMessageSchema.safeParse(body);
    
    if (!validation.success) {
      console.error("[API Assistant] Validation error:", validation.error.issues);
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.issues },
        { status: 400 }
      );
    }
    
    const { message, threadId, context } = validation.data;
    
    // Créer ou récupérer le thread
    let currentThreadId = threadId;
    
    if (!currentThreadId) {
      console.log("[API Assistant] Creating new thread...");
      try {
        const thread = await assistantService.createThread(
          profile.id,
          user.id
        );
        
        if (!thread) {
          console.error("[API Assistant] Failed to create thread");
          return NextResponse.json(
            { error: "Impossible de créer la conversation. Vérifiez que les tables de l'assistant existent." },
            { status: 500 }
          );
        }
        
        currentThreadId = thread.id;
        console.log("[API Assistant] Thread created:", currentThreadId);
      } catch (threadError: any) {
        console.error("[API Assistant] Thread creation error:", threadError.message);
        
        // Vérifier si c'est une erreur de table manquante
        if (threadError.message?.includes("relation") && threadError.message?.includes("does not exist")) {
          return NextResponse.json(
            { error: "Les tables de l'assistant IA ne sont pas créées. Appliquez la migration 20251206800000_assistant_ai_tables.sql" },
            { status: 503 }
          );
        }
        
        throw threadError;
      }
    } else {
      console.log("[API Assistant] Using existing thread:", currentThreadId);
      // Vérifier que le thread existe et appartient à l'utilisateur
      const { data: existingThread, error: threadError } = await supabase
        .from("assistant_threads")
        .select("profile_id")
        .eq("id", currentThreadId)
        .single();
      
      if (threadError) {
        console.error("[API Assistant] Thread lookup error:", threadError.message);
        
        // Vérifier si c'est une erreur de table manquante
        if (threadError.message?.includes("relation") && threadError.message?.includes("does not exist")) {
          return NextResponse.json(
            { error: "Les tables de l'assistant IA ne sont pas créées. Appliquez la migration." },
            { status: 503 }
          );
        }
      }
      
      if (!existingThread || existingThread.profile_id !== profile.id) {
        return NextResponse.json(
          { error: "Conversation non trouvée" },
          { status: 404 }
        );
      }
    }
    
    // Construire le contexte complet
    const fullContext = {
      userId: user.id,
      profileId: profile.id,
      role: profile.role as "owner" | "tenant" | "provider" | "admin",
      locale: "fr" as const,
      ...context,
    };
    
    console.log("[API Assistant] Sending message to assistant...");
    console.log("[API Assistant] Context:", { role: fullContext.role, profileId: fullContext.profileId });
    
    // Envoyer le message à l'assistant
    try {
      const result = await assistantService.sendMessage(
        currentThreadId,
        message,
        fullContext
      );
      
      console.log("[API Assistant] Response received, tools used:", result.toolsUsed);
      
      return NextResponse.json({
        success: true,
        threadId: currentThreadId,
        response: result.response,
        message: result.response, // Compatibilité
        toolsUsed: result.toolsUsed,
        requiresAction: result.requiresAction,
        actionType: result.actionType,
      });
    } catch (assistantError: any) {
      console.error("[API Assistant] Assistant error:", assistantError.message);
      console.error("[API Assistant] Stack:", assistantError.stack);
      throw assistantError;
    }
    
  } catch (error) {
    console.error("[API Assistant] Error:", error);
    
    // Gérer les erreurs spécifiques
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      // Erreur de clé API OpenAI
      if (errorMessage.includes("api key") || errorMessage.includes("apikey") || errorMessage.includes("invalid_api_key") || errorMessage.includes("incorrect api key")) {
        console.error("[API Assistant] Clé OpenAI non configurée ou invalide");
        return NextResponse.json(
          { error: "L'assistant IA n'est pas configuré. Veuillez contacter l'administrateur." },
          { status: 503 }
        );
      }
      
      // Rate limiting
      if (errorMessage.includes("rate limit") || errorMessage.includes("rate_limit")) {
        return NextResponse.json(
          { error: "Limite de requêtes atteinte. Veuillez réessayer dans quelques secondes." },
          { status: 429 }
        );
      }
      
      // Contexte trop long
      if (errorMessage.includes("context_length") || errorMessage.includes("maximum context length")) {
        return NextResponse.json(
          { error: "La conversation est trop longue. Veuillez démarrer une nouvelle conversation." },
          { status: 400 }
        );
      }
      
      // Erreur de table non trouvée (assistant_threads, assistant_messages)
      if (errorMessage.includes("relation") && (errorMessage.includes("does not exist") || errorMessage.includes("assistant_"))) {
        console.error("[API Assistant] Tables de l'assistant non trouvées - Migration requise");
        return NextResponse.json(
          { error: "L'assistant IA nécessite une mise à jour de la base de données. Contactez l'administrateur." },
          { status: 503 }
        );
      }
      
      // Erreur de quota OpenAI
      if (errorMessage.includes("quota") || errorMessage.includes("insufficient_quota")) {
        return NextResponse.json(
          { error: "Le quota de l'assistant IA est épuisé. Veuillez réessayer plus tard." },
          { status: 503 }
        );
      }
      
      // Timeout ou connexion
      if (errorMessage.includes("timeout") || errorMessage.includes("econnrefused") || errorMessage.includes("network")) {
        return NextResponse.json(
          { error: "Erreur de connexion au service IA. Veuillez réessayer." },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Une erreur est survenue avec l'assistant. Veuillez réessayer." },
      { status: 500 }
    );
  }
}

// ============================================
// OPTIONS - CORS
// ============================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

