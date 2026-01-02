/**
 * Assistant Multi-Agent avec Architecture Supervisor
 * SOTA 2026 - GPT-5.2 + LangGraph 1.0
 * 
 * Wrapper pour utiliser facilement l'architecture multi-agent Supervisor
 */

import { HumanMessage } from "@langchain/core/messages";
import { getMultiAgentGraph } from "./multi-agent-graph";
import type { AssistantContext } from "./types";

// ============================================
// TYPES
// ============================================

export interface MultiAgentInvokeParams {
  message: string;
  threadId: string;
  context: AssistantContext;
}

export interface MultiAgentInvokeResult {
  response: string;
  agentUsed: "property_agent" | "finance_agent" | "ticket_agent" | "legal_agent";
  toolsUsed: string[];
  requiresAction: boolean;
  actionType?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Invoque l'assistant multi-agent avec architecture Supervisor
 */
export async function invokeMultiAgentAssistant(
  params: MultiAgentInvokeParams
): Promise<MultiAgentInvokeResult> {
  const { message, threadId, context } = params;
  
  const config = {
    configurable: {
      thread_id: threadId,
    },
  };
  
  // Obtenir le graph multi-agent compilé
  const graph = await getMultiAgentGraph();
  
  // Invoquer le graph
  const result = await graph.invoke(
    {
      messages: [new HumanMessage(message)],
      context,
    },
    config
  );
  
  // Extraire la réponse finale
  const lastMessage = result.messages[result.messages.length - 1];
  const response = lastMessage.content as string;
  
  // Déterminer quel agent a été utilisé
  const activeAgent = result.activeAgent || "property_agent";
  
  // Collecter les tools utilisés
  const toolsUsed: string[] = [];
  for (const msg of result.messages) {
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        if (!toolsUsed.includes(tc.name)) {
          toolsUsed.push(tc.name);
        }
      }
    }
  }
  
  return {
    response,
    agentUsed: activeAgent as any,
    toolsUsed,
    requiresAction: false,
  };
}

/**
 * Stream la réponse de l'assistant multi-agent
 */
export async function* streamMultiAgentAssistant(
  params: MultiAgentInvokeParams
): AsyncGenerator<{
  type: "token" | "agent_switch" | "tool_start" | "tool_end" | "complete";
  content?: string;
  agentName?: string;
  toolName?: string;
}> {
  const { message, threadId, context } = params;
  
  const config = {
    configurable: {
      thread_id: threadId,
    },
  };
  
  // Obtenir le graph multi-agent compilé
  const graph = await getMultiAgentGraph();
  
  // Streamer la réponse
  const stream = await graph.stream(
    {
      messages: [new HumanMessage(message)],
      context,
    },
    {
      ...config,
      streamMode: "updates",
    }
  );
  
  let lastAgent: string | undefined;
  
  for await (const update of stream) {
    // Détecter les changements d'agent
    if (update.supervisor) {
      const newAgent = update.supervisor.activeAgent;
      if (newAgent && newAgent !== lastAgent) {
        yield { type: "agent_switch", agentName: newAgent };
        lastAgent = newAgent;
      }
    }
    
    // Traiter les messages des agents
    for (const [nodeName, nodeUpdate] of Object.entries(update)) {
      if (nodeName.includes("agent") && nodeUpdate.messages) {
        const messages = nodeUpdate.messages;
        for (const msg of messages) {
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            for (const tc of msg.tool_calls) {
              yield { type: "tool_start", toolName: tc.name };
            }
          } else if (msg.content) {
            yield { type: "token", content: msg.content as string };
          }
        }
      }
    }
  }
  
  yield { type: "complete" };
}

export default {
  invokeMultiAgentAssistant,
  streamMultiAgentAssistant,
};

