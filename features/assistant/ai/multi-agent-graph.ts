/**
 * Assistant IA Multi-Agent avec Architecture Supervisor
 * SOTA 2026 - GPT-5.2 + LangGraph 1.0 + PostgresSaver
 * 
 * Architecture Supervisor : Un agent central orchestre des agents spécialisés
 * - property_agent : Gestion des biens
 * - finance_agent : Gestion financière
 * - ticket_agent : Gestion des tickets
 * - legal_agent : Questions juridiques avec RAG
 */

import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { 
  BaseMessage, 
  HumanMessage, 
  AIMessage,
} from "@langchain/core/messages";
import { 
  createSupervisorAgent,
  createPropertyAgent,
  createFinanceAgent,
  createTicketAgent,
  createLegalAgent,
  routeToAgent,
} from "./agents";
import type { AssistantContext, UserRole } from "./types";

// ============================================
// STATE DEFINITION
// ============================================

function addMessages(existing: BaseMessage[], newMessages: BaseMessage[]): BaseMessage[] {
  return [...existing, ...newMessages];
}

const MultiAgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: addMessages,
    default: () => [],
  }),
  context: Annotation<AssistantContext>({
    default: () => ({
      userId: "",
      profileId: "",
      role: "owner" as const,
      locale: "fr" as const,
    }),
  } as any),
  // Agent actuellement actif
  activeAgent: Annotation<string | undefined>({
    default: () => undefined,
  } as any),
  // Résultats des agents
  agentResults: Annotation<Record<string, unknown>>({
    default: () => ({}),
  } as any),
});

type StateType = typeof MultiAgentState.State;

// ============================================
// NODES
// ============================================

/**
 * Node Supervisor : Route vers l'agent approprié
 */
async function supervisorNode(state: StateType): Promise<Partial<StateType>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const userMessage = lastMessage instanceof HumanMessage 
    ? lastMessage.content as string
    : "";
  
  // Route vers l'agent approprié (routage simple pour l'instant)
  // En production, on pourrait utiliser le supervisor agent pour un routage plus intelligent
  const targetAgent = routeToAgent(userMessage);
  
  return {
    activeAgent: targetAgent,
  };
}

/**
 * Node Property Agent
 */
async function propertyAgentNode(state: StateType): Promise<Partial<StateType>> {
  const agent = createPropertyAgent(state.context.role);
  const result = await agent.invoke(state);
  
  return {
    messages: result.messages || [],
    agentResults: {
      ...state.agentResults,
      property: result,
    },
  };
}

/**
 * Node Finance Agent
 */
async function financeAgentNode(state: StateType): Promise<Partial<StateType>> {
  const agent = createFinanceAgent(state.context.role);
  const result = await agent.invoke(state);
  
  return {
    messages: result.messages || [],
    agentResults: {
      ...state.agentResults,
      finance: result,
    },
  };
}

/**
 * Node Ticket Agent
 */
async function ticketAgentNode(state: StateType): Promise<Partial<StateType>> {
  const agent = createTicketAgent(state.context.role);
  const result = await agent.invoke(state);
  
  return {
    messages: result.messages || [],
    agentResults: {
      ...state.agentResults,
      ticket: result,
    },
  };
}

/**
 * Node Legal Agent
 */
async function legalAgentNode(state: StateType): Promise<Partial<StateType>> {
  const agent = createLegalAgent(state.context.role);
  const result = await agent.invoke(state);
  
  return {
    messages: result.messages || [],
    agentResults: {
      ...state.agentResults,
      legal: result,
    },
  };
}

// ============================================
// CONDITIONAL EDGES
// ============================================

/**
 * Route depuis le supervisor vers l'agent approprié
 */
function routeFromSupervisor(state: StateType): string {
  const activeAgent = state.activeAgent;
  
  if (!activeAgent) {
    return END;
  }
  
  switch (activeAgent) {
    case "property_agent":
      return "property_agent";
    case "finance_agent":
      return "finance_agent";
    case "ticket_agent":
      return "ticket_agent";
    case "legal_agent":
      return "legal_agent";
    default:
      return END;
  }
}

/**
 * Après exécution d'un agent, terminer ou continuer
 */
function shouldContinueAfterAgent(state: StateType): "supervisor" | "end" {
  // Pour l'instant, on termine après un agent
  // En production, on pourrait permettre plusieurs tours avec le supervisor
  return "end";
}

// ============================================
// GRAPH CONSTRUCTION
// ============================================

const multiAgentWorkflow = new StateGraph(MultiAgentState)
  // Ajouter les nodes
  .addNode("supervisor", supervisorNode)
  .addNode("property_agent", propertyAgentNode)
  .addNode("finance_agent", financeAgentNode)
  .addNode("ticket_agent", ticketAgentNode)
  .addNode("legal_agent", legalAgentNode)
  
  // Point d'entrée
  .addEdge(START, "supervisor")
  
  // Routing depuis le supervisor
  .addConditionalEdges("supervisor", routeFromSupervisor, {
    property_agent: "property_agent",
    finance_agent: "finance_agent",
    ticket_agent: "ticket_agent",
    legal_agent: "legal_agent",
  })
  
  // Après chaque agent, terminer (ou retourner au supervisor pour multi-tours)
  .addConditionalEdges("property_agent", shouldContinueAfterAgent)
  .addConditionalEdges("finance_agent", shouldContinueAfterAgent)
  .addConditionalEdges("ticket_agent", shouldContinueAfterAgent)
  .addConditionalEdges("legal_agent", shouldContinueAfterAgent);

// ============================================
// POSTGRES CHECKPOINTER
// ============================================

/**
 * Crée le checkpointer PostgresSaver pour la persistance
 */
let checkpointer: PostgresSaver | null = null;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL non configurée. Veuillez configurer la variable d'environnement DATABASE_URL."
      );
    }
    
    checkpointer = await PostgresSaver.fromConnString(databaseUrl);
    
    // Setup initial (à faire une seule fois)
    // En production, cela devrait être fait dans un script de migration
    try {
      await checkpointer.setup();
    } catch (error) {
      // Si la table existe déjà, c'est OK
      if (!(error as Error).message.includes("already exists")) {
        console.error("[MultiAgent] Erreur lors du setup du checkpointer:", error);
        throw error;
      }
    }
  }
  
  return checkpointer;
}

// ============================================
// COMPILED GRAPH
// ============================================

/**
 * Compile le graph avec PostgresSaver
 * Note: Cette fonction doit être appelée de manière asynchrone
 */
export async function compileMultiAgentGraph() {
  const checkpointer = await getCheckpointer();
  return multiAgentWorkflow.compile({ checkpointer });
}

// Export du graph non compilé pour tests
export { multiAgentWorkflow };

// Export par défaut (lazy compilation)
let compiledGraph: Awaited<ReturnType<typeof compileMultiAgentGraph>> | null = null;

export async function getMultiAgentGraph() {
  if (!compiledGraph) {
    compiledGraph = await compileMultiAgentGraph();
  }
  return compiledGraph;
}

