/**
 * API Route: Assistant IA avec Streaming + RAG
 * SOTA 2026 - Architecture AI-First
 * 
 * Endpoint optimisé pour le streaming avec enrichissement RAG
 */

import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ragPipeline } from "@/lib/ai/rag/rag-pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

// ============================================
// SYSTEM PROMPTS PAR RÔLE
// ============================================

const SYSTEM_PROMPTS: Record<string, string> = {
  owner: `Tu es **Tom**, l'assistant IA expert en gestion locative pour les propriétaires immobiliers en France.

🏠 **Tes capacités :**
- Rechercher et afficher les biens, locataires, paiements, tickets
- Fournir des conseils juridiques basés sur les textes de loi
- Calculer les révisions de loyer (IRL)
- Expliquer les procédures (congé, impayés, EDL)
- Générer des résumés de patrimoine

📊 **Tu dois être proactif :**
- Alerter sur les loyers en retard
- Rappeler les échéances de baux
- Suggérer des actions concrètes

⚖️ **Règles importantes :**
- Cite TOUJOURS tes sources quand tu donnes un conseil juridique
- Si tu n'es pas sûr, recommande de consulter un professionnel
- Utilise des emojis pour structurer (🏠 💰 📄 🔧)
- Sois concis mais complet`,

  tenant: `Tu es **Tom**, l'assistant bienveillant pour les locataires en France.

🏠 **Tes capacités :**
- Expliquer tes droits et devoirs de locataire
- Aider à signaler des problèmes (tickets maintenance)
- Expliquer les procédures (préavis, état des lieux)
- Clarifier les charges et le loyer

🛡️ **Rappel de tes droits :**
- Logement décent obligatoire
- Préavis de 1 mois en meublé, 3 mois en nu (1 mois en zone tendue)
- Dépôt de garantie : restitution sous 1 mois si EDL conforme

💡 **Tu dois :**
- Être rassurant et pédagogue
- Expliquer les termes juridiques simplement
- Proposer des étapes claires`,

  provider: `Tu es **Tom**, l'assistant pour les prestataires de services immobiliers.

🔧 **Tes capacités :**
- Consulter les demandes d'intervention
- Voir les détails des biens (adresse, accès)
- Expliquer les procédures d'intervention

📋 **Bonnes pratiques :**
- Confirmer les RDV 24h avant
- Prendre des photos avant/après
- Faire signer un bon d'intervention`,

  admin: `Tu es **Tom**, l'assistant pour l'administration de la plateforme.

⚙️ **Accès complet :**
- Statistiques globales et KPIs
- Tous les utilisateurs et propriétés
- Logs et historique

📊 **Métriques à surveiller :**
- Taux de recouvrement des loyers
- Temps de résolution des tickets
- Croissance utilisateurs`,
};

// ============================================
// POST - Stream avec RAG
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let traceId: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Non authentifié", { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response("Profil non trouvé", { status: 404 });
    }

    const { messages } = await request.json();
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Démarrer le trace Langfuse (si disponible)
    let langfuseService: any = null;
    try {
      const langfuseModule = await import("@/lib/ai/monitoring/langfuse.service");
      langfuseService = langfuseModule.langfuseService;
    } catch (e) {
      // Langfuse non disponible, continuer sans
    }

    if (langfuseService) {
      try {
        traceId = await langfuseService.startTrace({
        name: "assistant-stream",
        userId: user.id,
        metadata: {
          role: profile.role,
          messageCount: messages.length,
        },
      });
      } catch (e) {
        // Langfuse optionnel, continuer sans
        console.warn("[Stream] Langfuse unavailable:", e);
      }
    }

    // RAG: Recherche de contexte pertinent
    let ragContext = "";
    let ragSources: string[] = [];

    try {
      const ragResult = await ragPipeline.enrichSystemPrompt(
        SYSTEM_PROMPTS[profile.role] || SYSTEM_PROMPTS.owner,
        lastMessage,
        profile.id,
        {
          legalLimit: 3,
          contextLimit: 2,
          knowledgeLimit: 2,
          hybridSearch: true,
          minSimilarity: 0.65,
        }
      );

      ragContext = ragResult.prompt;
      ragSources = ragResult.sources;

      console.log(`[Stream] RAG enriched with ${ragSources.length} sources`);
    } catch (ragError) {
      console.error("[Stream] RAG error, continuing without:", ragError);
      ragContext = SYSTEM_PROMPTS[profile.role] || SYSTEM_PROMPTS.owner;
    }

    // Stream la réponse avec GPT-5.2 Thinking (par défaut)
    // Support du contexte étendu jusqu'à 400k tokens
    const modelName = process.env.OPENAI_MODEL || "gpt-5.2-thinking";
    const result = await streamText({
      model: openai(modelName),
      system: ragContext,
      messages,
      temperature: 0.3,
      maxTokens: 16384, // Augmenté pour GPT-5.2 (support jusqu'à 128k output)
      onFinish: async ({ text, usage }) => {
        const duration = Date.now() - startTime;

        // Log dans Langfuse (si disponible)
        if (traceId && langfuseService) {
          try {
            await langfuseService.endTrace(traceId, {
              output: text.substring(0, 500),
              metadata: {
                tokensUsed: usage?.totalTokens,
                ragSourcesCount: ragSources.length,
                durationMs: duration,
              },
            });
          } catch (e) {
            // Ignore Langfuse errors
          }
        }

        // Log dans ai_conversations pour analytics
        try {
          await supabase.from("ai_conversations").insert({
            profile_id: profile.id,
            user_query: lastMessage.substring(0, 1000),
            assistant_response: text.substring(0, 5000),
            response_time_ms: duration,
            tokens_used: usage?.totalTokens,
            model_used: modelName,
            rag_docs_retrieved: ragSources.length,
            rag_sources: ragSources,
          });
        } catch (dbError) {
          console.warn("[Stream] Failed to log conversation:", dbError);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("[Stream] Error:", error);

    // Log l'erreur dans Langfuse (si disponible)
    if (traceId && langfuseService) {
      try {
        await langfuseService.endTrace(traceId, {
          metadata: { error: String(error) },
          level: "error",
        });
      } catch (e) {
        // Ignore
      }
    }

    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ============================================
// OPTIONS - CORS
// ============================================

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

