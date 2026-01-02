/**
 * Service Assistant IA
 * SOTA Décembre 2025 - GPT-5.2 + LangGraph 1.0
 * 
 * Supporte deux architectures :
 * - Architecture simple (property-assistant.graph.ts) : Agent unique avec tools
 * - Architecture multi-agent (multi-agent-graph.ts) : Supervisor avec agents spécialisés
 */

import { createClient } from "@/lib/supabase/server";
import { 
  invokeAssistant, 
  streamAssistant,
  type AssistantInvokeParams,
  type AssistantInvokeResult 
} from "../ai/property-assistant.graph";
import {
  invokeMultiAgentAssistant,
  streamMultiAgentAssistant,
  type MultiAgentInvokeParams,
  type MultiAgentInvokeResult,
} from "../ai/multi-agent-assistant";
import type { AssistantContext, UserRole } from "../ai/types";
import { v4 as uuidv4 } from "uuid";

// ============================================
// TYPES
// ============================================

export interface ConversationThread {
  id: string;
  userId: string;
  profileId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  messageCount: number;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  createdAt: string;
}

// ============================================
// ASSISTANT SERVICE
// ============================================

export class AssistantService {
  /**
   * Récupère ou crée le contexte utilisateur
   */
  async getUserContext(): Promise<AssistantContext | null> {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) return null;
    
    return {
      userId: user.id,
      profileId: profile.id,
      role: profile.role as UserRole,
      locale: "fr",
    };
  }
  
  /**
   * Liste les conversations de l'utilisateur
   */
  async listThreads(profileId: string): Promise<ConversationThread[]> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("assistant_threads")
      .select(`
        id,
        user_id,
        profile_id,
        title,
        created_at,
        updated_at,
        last_message,
        message_count
      `)
      .eq("profile_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(50);
    
    if (error) {
      console.error("[AssistantService] Error listing threads:", error);
      return [];
    }
    
    return (data || []).map(t => ({
      id: t.id,
      userId: t.user_id,
      profileId: t.profile_id,
      title: t.title || "Nouvelle conversation",
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      lastMessage: t.last_message,
      messageCount: t.message_count || 0,
    }));
  }
  
  /**
   * Crée un nouveau thread de conversation
   */
  async createThread(profileId: string, userId: string, title?: string): Promise<ConversationThread | null> {
    const supabase = await createClient();
    
    const threadId = uuidv4();
    
    const { data, error } = await supabase
      .from("assistant_threads")
      .insert({
        id: threadId,
        user_id: userId,
        profile_id: profileId,
        title: title || "Nouvelle conversation",
        message_count: 0,
      })
      .select()
      .single();
    
    if (error) {
      console.error("[AssistantService] Error creating thread:", error);
      return null;
    }
    
    return {
      id: data.id,
      userId: data.user_id,
      profileId: data.profile_id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      messageCount: 0,
    };
  }
  
  /**
   * Récupère les messages d'un thread
   */
  async getThreadMessages(threadId: string, profileId: string): Promise<ThreadMessage[]> {
    const supabase = await createClient();
    
    // Vérifier que le thread appartient à l'utilisateur
    const { data: thread } = await supabase
      .from("assistant_threads")
      .select("profile_id")
      .eq("id", threadId)
      .single();
    
    if (!thread || thread.profile_id !== profileId) {
      return [];
    }
    
    const { data, error } = await supabase
      .from("assistant_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    
    if (error) {
      console.error("[AssistantService] Error getting messages:", error);
      return [];
    }
    
    return (data || []).map(m => ({
      id: m.id,
      threadId: m.thread_id,
      role: m.role,
      content: m.content,
      toolsUsed: m.tools_used,
      createdAt: m.created_at,
    }));
  }
  
  /**
   * Envoie un message à l'assistant et obtient une réponse
   * Utilise l'architecture simple par défaut
   * 
   * Pour utiliser l'architecture multi-agent Supervisor, utiliser sendMessageMultiAgent()
   */
  async sendMessage(
    threadId: string, 
    message: string,
    context: AssistantContext
  ): Promise<AssistantInvokeResult & { messageId: string }> {
    const supabase = await createClient();
    
    // Sauvegarder le message utilisateur
    const { data: userMessage, error: userMsgError } = await supabase
      .from("assistant_messages")
      .insert({
        thread_id: threadId,
        role: "user",
        content: message,
      })
      .select("id")
      .single();
    
    if (userMsgError) {
      console.error("[AssistantService] Error saving user message:", userMsgError);
    }
    
    // Invoquer l'assistant
    const params: AssistantInvokeParams = {
      message,
      threadId,
      context,
    };
    
    const result = await invokeAssistant(params);
    
    // Sauvegarder la réponse de l'assistant
    const { data: assistantMessage, error: assistantMsgError } = await supabase
      .from("assistant_messages")
      .insert({
        thread_id: threadId,
        role: "assistant",
        content: result.response,
        tools_used: result.toolsUsed,
      })
      .select("id")
      .single();
    
    if (assistantMsgError) {
      console.error("[AssistantService] Error saving assistant message:", assistantMsgError);
    }
    
    // Mettre à jour le thread
    await supabase
      .from("assistant_threads")
      .update({
        last_message: message.substring(0, 100),
        message_count: supabase.rpc("increment_message_count", { thread_id_param: threadId }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);
    
    // Générer un titre si c'est le premier message
    const { data: thread } = await supabase
      .from("assistant_threads")
      .select("title, message_count")
      .eq("id", threadId)
      .single();
    
    if (thread && thread.title === "Nouvelle conversation" && thread.message_count <= 2) {
      // Utiliser le premier message comme titre (tronqué)
      const newTitle = message.length > 50 ? message.substring(0, 47) + "..." : message;
      await supabase
        .from("assistant_threads")
        .update({ title: newTitle })
        .eq("id", threadId);
    }
    
    return {
      ...result,
      messageId: assistantMessage?.id || "",
    };
  }
  
  /**
   * Envoie un message à l'assistant multi-agent Supervisor
   * Utilise l'architecture Supervisor avec agents spécialisés
   */
  async sendMessageMultiAgent(
    threadId: string,
    message: string,
    context: AssistantContext
  ): Promise<MultiAgentInvokeResult & { messageId: string }> {
    const supabase = await createClient();
    
    // Sauvegarder le message utilisateur
    const { data: userMessage, error: userMsgError } = await supabase
      .from("assistant_messages")
      .insert({
        thread_id: threadId,
        role: "user",
        content: message,
      })
      .select("id")
      .single();
    
    if (userMsgError) {
      console.error("[AssistantService] Error saving user message:", userMsgError);
    }
    
    // Invoquer l'assistant multi-agent
    const params: MultiAgentInvokeParams = {
      message,
      threadId,
      context,
    };
    
    const result = await invokeMultiAgentAssistant(params);
    
    // Sauvegarder la réponse de l'assistant
    const { data: assistantMessage, error: assistantMsgError } = await supabase
      .from("assistant_messages")
      .insert({
        thread_id: threadId,
        role: "assistant",
        content: result.response,
        tools_used: result.toolsUsed,
      })
      .select("id")
      .single();
    
    if (assistantMsgError) {
      console.error("[AssistantService] Error saving assistant message:", assistantMsgError);
    }
    
    // Mettre à jour le thread
    await supabase
      .from("assistant_threads")
      .update({
        last_message: message.substring(0, 100),
        message_count: supabase.rpc("increment_message_count", { thread_id_param: threadId }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);
    
    return {
      ...result,
      messageId: assistantMessage?.id || "",
    };
  }
  
  /**
   * Stream la réponse de l'assistant (pour UI temps réel)
   */
  async *streamMessage(
    threadId: string,
    message: string,
    context: AssistantContext
  ) {
    const supabase = await createClient();
    
    // Sauvegarder le message utilisateur
    await supabase
      .from("assistant_messages")
      .insert({
        thread_id: threadId,
        role: "user",
        content: message,
      });
    
    // Streamer la réponse
    const params: AssistantInvokeParams = {
      message,
      threadId,
      context,
    };
    
    let fullResponse = "";
    const toolsUsed: string[] = [];
    
    for await (const chunk of streamAssistant(params)) {
      yield chunk;
      
      if (chunk.type === "token" && chunk.content) {
        fullResponse += chunk.content;
      }
      if (chunk.type === "tool_start" && chunk.toolName) {
        toolsUsed.push(chunk.toolName);
      }
    }
    
    // Sauvegarder la réponse complète
    await supabase
      .from("assistant_messages")
      .insert({
        thread_id: threadId,
        role: "assistant",
        content: fullResponse,
        tools_used: toolsUsed.length > 0 ? toolsUsed : null,
      });
    
    // Mettre à jour le thread
    await supabase
      .from("assistant_threads")
      .update({
        last_message: message.substring(0, 100),
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);
  }
  
  /**
   * Supprime un thread
   */
  async deleteThread(threadId: string, profileId: string): Promise<boolean> {
    const supabase = await createClient();
    
    // Vérifier la propriété
    const { data: thread } = await supabase
      .from("assistant_threads")
      .select("profile_id")
      .eq("id", threadId)
      .single();
    
    if (!thread || thread.profile_id !== profileId) {
      return false;
    }
    
    // Supprimer les messages
    await supabase
      .from("assistant_messages")
      .delete()
      .eq("thread_id", threadId);
    
    // Supprimer le thread
    const { error } = await supabase
      .from("assistant_threads")
      .delete()
      .eq("id", threadId);
    
    return !error;
  }
}

// Singleton
export const assistantService = new AssistantService();

export default assistantService;

