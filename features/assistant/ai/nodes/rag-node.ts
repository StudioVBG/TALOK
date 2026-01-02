/**
 * Node RAG pour LangGraph
 * SOTA 2026 - Retrieval Augmented Generation
 * 
 * Enrichit le contexte de la conversation avec des documents
 * juridiques et le contexte utilisateur personnalisé.
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ragPipeline } from "@/lib/ai/rag/rag-pipeline";
import type { AssistantContext } from "../types";
import type { RAGSearchResult } from "@/lib/ai/rag/types";

// ============================================
// TYPES
// ============================================

export interface RAGNodeState {
  messages: any[];
  context: AssistantContext;
  ragContext?: string;
  ragSources?: string[];
  ragResults?: RAGSearchResult;
}

export interface RAGNodeOutput {
  ragContext?: string;
  ragSources?: string[];
  ragResults?: RAGSearchResult;
}

// ============================================
// RAG NODE
// ============================================

/**
 * Node LangGraph qui enrichit la conversation avec le contexte RAG
 * 
 * Ce node doit être placé AVANT le node agent dans le graph
 * pour que le contexte soit disponible lors de l'appel au LLM.
 */
export async function ragRetrievalNode(
  state: RAGNodeState
): Promise<RAGNodeOutput> {
  console.log("[RAG Node] Starting retrieval...");
  
  // Extraire la dernière question utilisateur
  const lastUserMessage = findLastUserMessage(state.messages);
  
  if (!lastUserMessage) {
    console.log("[RAG Node] No user message found, skipping RAG");
    return {};
  }
  
  const query = extractMessageContent(lastUserMessage);
  
  if (!query || query.length < 3) {
    console.log("[RAG Node] Query too short, skipping RAG");
    return {};
  }
  
  console.log("[RAG Node] Query:", query.substring(0, 100));
  
  try {
    // Recherche RAG complète
    const results = await ragPipeline.search(
      query,
      state.context.profileId,
      {
        legalLimit: 3,
        contextLimit: 2,
        knowledgeLimit: 2,
        hybridSearch: true, // Utiliser la recherche hybride pour plus de précision
        vectorWeight: 0.7,
        minSimilarity: 0.65,
      }
    );
    
    // Formater pour le prompt
    const ragContext = ragPipeline.formatForSystemPrompt(results);
    const ragSources = ragPipeline.collectSources(results);
    
    console.log(
      `[RAG Node] Retrieved: ${results.legal.length} legal, ${results.userContext.length} context, ${ragSources.length} total sources`
    );
    
    return {
      ragContext,
      ragSources,
      ragResults: results,
    };
  } catch (error) {
    console.error("[RAG Node] Error during retrieval:", error);
    // En cas d'erreur, continuer sans RAG
    return {};
  }
}

/**
 * Version légère du node RAG (legal seulement)
 * À utiliser quand la performance est critique
 */
export async function ragLegalOnlyNode(
  state: RAGNodeState
): Promise<RAGNodeOutput> {
  const lastUserMessage = findLastUserMessage(state.messages);
  
  if (!lastUserMessage) {
    return {};
  }
  
  const query = extractMessageContent(lastUserMessage);
  
  if (!query || query.length < 3) {
    return {};
  }
  
  try {
    const { legal, userContext } = await ragPipeline.quickSearch(
      query,
      state.context.profileId
    );
    
    const results: RAGSearchResult = {
      legal,
      userContext,
      platformKnowledge: [],
    };
    
    const ragContext = ragPipeline.formatForSystemPrompt(results);
    const ragSources = ragPipeline.collectSources(results);
    
    return {
      ragContext,
      ragSources,
      ragResults: results,
    };
  } catch (error) {
    console.error("[RAG Node Lite] Error:", error);
    return {};
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Trouve le dernier message utilisateur dans la liste
 */
function findLastUserMessage(messages: any[]): any | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    
    // LangChain message
    if (msg instanceof HumanMessage) {
      return msg;
    }
    
    // Message avec _getType
    if (typeof msg._getType === "function" && msg._getType() === "human") {
      return msg;
    }
    
    // Message avec role
    if (msg.role === "user" || msg.role === "human") {
      return msg;
    }
  }
  
  return null;
}

/**
 * Extrait le contenu textuel d'un message
 */
function extractMessageContent(message: any): string {
  if (!message) return "";
  
  // String direct
  if (typeof message.content === "string") {
    return message.content;
  }
  
  // Array de content blocks (multimodal)
  if (Array.isArray(message.content)) {
    const textBlock = message.content.find(
      (block: any) => block.type === "text" || typeof block.text === "string"
    );
    return textBlock?.text || textBlock?.content || "";
  }
  
  // Fallback
  return String(message.content || "");
}

/**
 * Injecte le contexte RAG dans le prompt système
 */
export function injectRAGIntoSystemPrompt(
  systemPrompt: string,
  ragContext?: string
): string {
  if (!ragContext || ragContext.trim().length === 0) {
    return systemPrompt;
  }
  
  return `${systemPrompt}\n\n${ragContext}`;
}

/**
 * Décide si le RAG doit être utilisé pour cette requête
 * (Peut être utilisé comme condition dans le graph)
 */
export function shouldUseRAG(state: RAGNodeState): boolean {
  const lastUserMessage = findLastUserMessage(state.messages);
  
  if (!lastUserMessage) {
    return false;
  }
  
  const query = extractMessageContent(lastUserMessage);
  
  // Pas de RAG pour les messages trop courts
  if (query.length < 10) {
    return false;
  }
  
  // Pas de RAG pour les salutations simples
  const greetings = ["bonjour", "salut", "hello", "merci", "ok", "d'accord"];
  if (greetings.some((g) => query.toLowerCase().trim() === g)) {
    return false;
  }
  
  return true;
}

// ============================================
// EXPORTS
// ============================================

export default {
  ragRetrievalNode,
  ragLegalOnlyNode,
  injectRAGIntoSystemPrompt,
  shouldUseRAG,
};

