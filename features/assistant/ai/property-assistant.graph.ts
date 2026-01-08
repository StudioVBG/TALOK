/**
 * Assistant IA de Talok
 * SOTA Décembre 2025 - GPT-5.2 + LangGraph 1.0
 * 
 * Architecture ReAct avec mémoire persistante et tools adaptés par rôle
 * Conseils personnalisés selon le type de compte
 * 
 * NOTE: Pour l'architecture multi-agent Supervisor, utiliser multi-agent-graph.ts
 */

import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ChatOpenAI } from "@langchain/openai";
import { 
  BaseMessage, 
  HumanMessage, 
  AIMessage, 
  SystemMessage,
  ToolMessage 
} from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { getToolsForRole } from "./tools";
import { createThinkingModel } from "@/lib/ai/config";
import type { AssistantContext, UserRole } from "./types";

// ============================================
// STATE DEFINITION avec Annotation API
// ============================================

/**
 * Reducer pour les messages - ajoute les nouveaux messages à l'historique
 */
function addMessages(existing: BaseMessage[], newMessages: BaseMessage[]): BaseMessage[] {
  return [...existing, ...newMessages];
}

const AssistantState = Annotation.Root({
  // Messages avec reducer pour accumulation
  messages: Annotation<BaseMessage[]>({
    reducer: addMessages,
    default: () => [],
  }),
  
  // Contexte utilisateur
  context: Annotation<AssistantContext>({
    default: () => ({
      userId: "",
      profileId: "",
      role: "owner" as const,
      locale: "fr" as const,
    }),
  }),
  
  // Résultats des tools
  toolResults: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
  
  // Metadata
  lastToolCalled: Annotation<string | undefined>(),
  confidence: Annotation<number>({
    default: () => 0.5,
  }),
  requiresHumanApproval: Annotation<boolean>({
    default: () => false,
  }),
  approvalType: Annotation<"signature" | "payment" | "legal" | "other" | undefined>(),
});

type StateType = typeof AssistantState.State;

// ============================================
// SYSTEM PROMPTS ENRICHIS PAR RÔLE
// ============================================

const SYSTEM_PROMPTS: Record<UserRole, string> = {
  owner: `Tu es **Tom**, l'assistant IA expert en gestion locative pour les propriétaires immobiliers en France.

🏠 **Tes capacités :**
- Rechercher et afficher les biens, locataires, paiements, tickets, documents
- Créer des tickets de maintenance
- Générer des quittances et factures
- Programmer des visites (EDL, maintenance)
- Fournir des résumés financiers

📊 **Conseils proactifs que tu dois donner :**
- Si des loyers sont en retard → suggérer une relance ou un échéancier
- Si un ticket est ouvert depuis longtemps → recommander d'assigner un prestataire
- Si un bail arrive à échéance dans 3 mois → rappeler de prévoir le renouvellement
- Si un locataire n'a pas d'assurance → alerter sur le risque

💡 **Bonnes pratiques à partager :**
- Révision annuelle des loyers (IRL) : chaque année à la date anniversaire du bail
- Vérification des attestations d'assurance habitation chaque année
- Régularisation des charges : une fois par an avec justificatifs
- État des lieux : toujours avec photos horodatées et signé par les deux parties
- Dépôt de garantie : 1 mois max (nu) ou 2 mois (meublé), restitution sous 1 mois si conforme

📋 **Format de réponse :**
- Utilise des emojis pour structurer (🏠 💰 📄 🔧)
- Donne des montants précis quand disponibles
- Suggère toujours une action concrète
- Sois proactif dans tes conseils

⚠️ **Limites :**
- Pour les conseils juridiques complexes → recommande un avocat spécialisé en droit immobilier
- Pour les questions fiscales pointues → recommande un comptable ou expert-comptable
- Pour les litiges → suggère d'abord la médiation, puis la commission de conciliation`,

  tenant: `Tu es **Tom**, l'assistant IA bienveillant pour les locataires en France.

🏠 **Tes capacités :**
- Consulter ton bail et ses conditions
- Voir tes paiements et historique
- Signaler un problème (ticket maintenance)
- Demander des documents (quittances)
- Suivre l'avancement des réparations

📊 **Conseils proactifs :**
- Si un loyer est bientôt dû → rappeler la date d'échéance et le montant
- Si une quittance est disponible → proposer le téléchargement
- Si un ticket est en cours → donner le statut et l'estimation de résolution
- Avant la fin du bail → informer sur les démarches (préavis, EDL sortie, restitution dépôt)

💡 **Tes droits en tant que locataire (à rappeler quand pertinent) :**
- **Logement décent** : Le propriétaire doit fournir un logement sans risque pour ta santé/sécurité
- **Délai de préavis** : 
  - 3 mois en location nue (1 mois en zone tendue)
  - 1 mois en meublé
- **Dépôt de garantie** : Restitution sous 1 mois si EDL conforme, 2 mois sinon
- **Réparations** : Le décret du 26 août 1987 liste ce qui est à ta charge vs propriétaire
- **Quittance** : Tu peux l'exiger gratuitement pour tout loyer payé

🛡️ **Réparations locatives (à ta charge) :**
- Entretien courant (joints, interrupteurs, ampoules)
- Menues réparations
- Entretien du jardin si privatif

🔧 **Réparations propriétaire :**
- Gros œuvre, toiture, façade
- Chauffage, plomberie (sauf entretien courant)
- Mise aux normes électriques/gaz

📋 **Format de réponse :**
- Sois rassurant et pédagogue
- Explique tes droits quand pertinent
- Propose toujours une action simple et claire
- Indique les délais légaux quand applicable

⚠️ **En cas de litige :**
1. D'abord dialogue écrit avec le propriétaire (garder une trace)
2. Ensuite commission départementale de conciliation (CDC) - gratuit
3. En dernier recours, tribunal judiciaire`,

  provider: `Tu es **Tom**, l'assistant IA professionnel pour les prestataires de services immobiliers.

🔧 **Tes capacités :**
- Consulter les demandes d'intervention assignées
- Voir les détails des biens à visiter (adresse, accès, contact)
- Mettre à jour le statut des interventions
- Consulter l'historique de tes jobs et facturations

📊 **Informations clés fournies :**
- Adresse complète et instructions d'accès
- Contact du locataire et/ou propriétaire
- Description détaillée du problème signalé
- Photos du problème si disponibles
- Budget estimé ou devis demandé

💡 **Bonnes pratiques professionnelles :**
- **Avant intervention** : Confirmer le RDV 24h avant par SMS/email
- **Sur place** : Prendre des photos avant/après l'intervention
- **Après intervention** : Faire signer un bon d'intervention au locataire
- **Facturation** : Soumettre le devis/facture sous 48h maximum
- **Garantie** : Informer sur la garantie de ton travail

📋 **Format de réponse :**
- Infos pratiques d'abord (adresse, contact, accès)
- Détails techniques ensuite (description du problème)
- Actions possibles en conclusion (confirmer RDV, demander plus d'infos)

⏰ **Délais recommandés :**
- Urgence (dégât des eaux, panne chauffage hiver) : intervention sous 24-48h
- Normal : intervention sous 1 semaine
- Non urgent : intervention sous 2 semaines`,

  admin: `Tu es **Tom**, l'assistant IA pour l'administration de la plateforme de gestion locative.

⚙️ **Accès complet :**
- Tous les utilisateurs (propriétaires, locataires, prestataires)
- Toutes les propriétés et baux de la plateforme
- Statistiques globales et KPIs détaillés
- Validations en attente (prestataires, biens)
- Logs et historique des actions

📊 **Métriques clés à surveiller :**
- **Taux de recouvrement** : % des loyers encaissés vs dus
- **Temps moyen de résolution** : délai entre ouverture et fermeture d'un ticket
- **Nouvelles inscriptions** : croissance de la base utilisateurs
- **Taux de rétention** : utilisateurs actifs vs inscrits
- **Prestataires en attente** : nombre à valider

💡 **Actions administratives disponibles :**
- Valider ou rejeter les prestataires (avec motif)
- Consulter les statistiques détaillées
- Voir les alertes et anomalies (impayés importants, tickets bloqués)
- Générer des rapports d'activité

🚨 **Alertes automatiques à signaler :**
- Prestataires en attente depuis plus de 7 jours
- Tickets critiques non assignés depuis 48h
- Taux d'impayés > 10% sur un propriétaire
- Utilisateurs signalés ou comportements suspects

📋 **Format admin :**
- Données chiffrées et précises avec % d'évolution
- Comparaisons avec la période précédente
- Mise en avant des anomalies ou alertes
- Actions recommandées pour chaque situation`,
};

// ============================================
// MODEL CONFIGURATION
// ============================================

/**
 * Vérifie si l'API OpenAI est configurée
 */
function isOpenAIConfigured(): boolean {
  const apiKey = process.env.OPENAI_API_KEY;
  return !!apiKey && apiKey.length > 10 && apiKey.startsWith('sk-');
}

/**
 * Crée le modèle LLM configuré avec GPT-5.2 Thinking par défaut
 */
function createModel() {
  // Vérifier que la clé API est configurée
  if (!isOpenAIConfigured()) {
    throw new Error("OPENAI_API_KEY non configurée ou invalide. Veuillez configurer la clé API dans les variables d'environnement.");
  }
  
  // Utiliser GPT-5.2 Thinking par défaut
  return createThinkingModel();
}

// ============================================
// DYNAMIC TOOL NODE (selon le rôle)
// ============================================

function createToolNodeForRole(role: UserRole) {
  const tools = getToolsForRole(role);
  return new ToolNode(tools);
}

// ============================================
// NODES
// ============================================

/**
 * Node: Appel du modèle LLM avec tools adaptés au rôle
 */
async function callModel(state: StateType): Promise<Partial<StateType>> {
  const model = createModel();
  const roleTools = getToolsForRole(state.context.role);
  const modelWithTools = model.bindTools(roleTools);
  
  // Construire le prompt système basé sur le rôle
  const systemPrompt = SYSTEM_PROMPTS[state.context.role] || SYSTEM_PROMPTS.owner;
  
  // Ajouter le contexte dynamique
  let contextInfo = `\n\n📍 **Contexte actuel :**
- Rôle: ${state.context.role}
- Profile ID: ${state.context.profileId}`;
  
  if (state.context.currentPropertyId) {
    contextInfo += `\n- Bien sélectionné: ${state.context.currentPropertyId}`;
  }
  if (state.context.currentLeaseId) {
    contextInfo += `\n- Bail sélectionné: ${state.context.currentLeaseId}`;
  }
  if (state.context.currentTicketId) {
    contextInfo += `\n- Ticket sélectionné: ${state.context.currentTicketId}`;
  }
  
  const fullSystemPrompt = systemPrompt + contextInfo;
  
  // Préparer les messages
  const messagesWithSystem = [
    new SystemMessage(fullSystemPrompt),
    ...state.messages,
  ];
  
  // Appeler le modèle
  const response = await modelWithTools.invoke(messagesWithSystem);
  
  // Vérifier si une action nécessite une approbation humaine
  let requiresApproval = false;
  let approvalType: StateType["approvalType"] = undefined;
  
  if (response.tool_calls && response.tool_calls.length > 0) {
    const criticalTools = ["create_invoice", "generate_receipt", "terminate_lease"];
    const toolNames = response.tool_calls.map(tc => tc.name);
    
    if (toolNames.some(name => criticalTools.includes(name))) {
      // Pour l'instant, on ne bloque pas mais on pourrait implémenter HITL ici
      // requiresApproval = true;
      // approvalType = "payment";
    }
  }
  
  return {
    messages: [response],
    lastToolCalled: response.tool_calls?.[0]?.name,
    requiresHumanApproval: requiresApproval,
    approvalType,
  };
}

/**
 * Node: Exécution des tools adaptés au rôle
 */
async function executeTools(state: StateType): Promise<Partial<StateType>> {
  const toolNode = createToolNodeForRole(state.context.role);
  
  // Utiliser le ToolNode pour exécuter les tools
  const result = await toolNode.invoke(state);
  
  // Stocker les résultats
  const toolResults: Record<string, unknown> = { ...state.toolResults };
  
  if (result.messages) {
    for (const msg of result.messages) {
      if (msg instanceof ToolMessage) {
        toolResults[msg.name || "unknown"] = msg.content;
      }
    }
  }
  
  return {
    messages: result.messages,
    toolResults,
  };
}

// ============================================
// CONDITIONAL EDGES
// ============================================

/**
 * Détermine si on doit continuer avec les tools ou terminer
 */
function shouldContinue(state: StateType): "tools" | "end" {
  const lastMessage = state.messages[state.messages.length - 1];
  
  // Si c'est un message AI avec des tool_calls, exécuter les tools
  if (
    lastMessage instanceof AIMessage &&
    lastMessage.tool_calls &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }
  
  // Sinon, terminer
  return "end";
}

// ============================================
// GRAPH CONSTRUCTION
// ============================================

const workflow = new StateGraph(AssistantState)
  // Ajouter les nodes
  .addNode("agent", callModel)
  .addNode("tools", executeTools)
  
  // Définir le point d'entrée
  .addEdge(START, "agent")
  
  // Ajouter les edges conditionnels
  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    end: END,
  })
  
  // Les tools retournent toujours vers l'agent
  .addEdge("tools", "agent");

// ============================================
// POSTGRES CHECKPOINTER (MÉMOIRE DURABLE)
// ============================================

/**
 * Crée le checkpointer PostgresSaver pour la persistance production
 */
let checkpointer: PostgresSaver | null = null;

async function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      console.warn("[Assistant] DATABASE_URL non configurée, utilisation de MemorySaver en fallback");
      // Fallback sur MemorySaver si DATABASE_URL n'est pas configurée
      const { MemorySaver } = await import("@langchain/langgraph");
      return new MemorySaver() as any;
    }
    
    try {
      checkpointer = await PostgresSaver.fromConnString(databaseUrl);
      // Setup initial (à faire une seule fois)
      await checkpointer.setup();
    } catch (error) {
      // Si la table existe déjà ou autre erreur, utiliser MemorySaver en fallback
      console.warn("[Assistant] Erreur lors du setup PostgresSaver, utilisation de MemorySaver:", error);
      const { MemorySaver } = await import("@langchain/langgraph");
      return new MemorySaver() as any;
    }
  }
  
  return checkpointer;
}

// ============================================
// COMPILED GRAPH (LAZY)
// ============================================

let compiledGraph: ReturnType<typeof workflow.compile> | null = null;

export async function getPropertyAssistantGraph() {
  if (!compiledGraph) {
    const checkpointer = await getCheckpointer();
    compiledGraph = workflow.compile({ checkpointer });
  }
  return compiledGraph;
}

// Export pour compatibilité (utilise MemorySaver par défaut si pas de DB)
// En production, utiliser getPropertyAssistantGraph() pour PostgresSaver
import { MemorySaver } from "@langchain/langgraph";
export const propertyAssistantGraph = workflow.compile({
  checkpointer: new MemorySaver(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

export interface AssistantInvokeParams {
  message: string;
  threadId: string;
  context: AssistantContext;
}

export interface AssistantInvokeResult {
  response: string;
  toolsUsed: string[];
  requiresAction: boolean;
  actionType?: string;
}

/**
 * Fonction helper pour invoquer l'assistant
 * Utilise PostgresSaver si disponible, sinon MemorySaver
 */
export async function invokeAssistant(
  params: AssistantInvokeParams
): Promise<AssistantInvokeResult> {
  const { message, threadId, context } = params;
  
  const config = {
    configurable: {
      thread_id: threadId,
    },
  };
  
  // Utiliser le graph avec PostgresSaver si disponible
  const graph = await getPropertyAssistantGraph();
  
  const result = await graph.invoke(
    {
      messages: [new HumanMessage(message)],
      context,
    },
    config
  );
  
  // Extraire la réponse finale
  const lastMessage = result.messages[result.messages.length - 1];
  const response = lastMessage instanceof AIMessage 
    ? (lastMessage.content as string)
    : String(lastMessage.content);
  
  // Collecter les tools utilisés
  const toolsUsed: string[] = [];
  for (const msg of result.messages) {
    if (msg instanceof AIMessage && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (!toolsUsed.includes(tc.name)) {
          toolsUsed.push(tc.name);
        }
      }
    }
  }
  
  return {
    response,
    toolsUsed,
    requiresAction: result.requiresHumanApproval,
    actionType: result.approvalType,
  };
}

/**
 * Fonction helper pour le streaming
 * Utilise PostgresSaver si disponible, sinon MemorySaver
 */
export async function* streamAssistant(
  params: AssistantInvokeParams
): AsyncGenerator<{
  type: "token" | "tool_start" | "tool_end" | "complete";
  content?: string;
  toolName?: string;
}> {
  const { message, threadId, context } = params;
  
  const config = {
    configurable: {
      thread_id: threadId,
    },
  };
  
  // Utiliser le graph avec PostgresSaver si disponible
  const graph = await getPropertyAssistantGraph();
  
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
  
  for await (const update of stream) {
    // Traiter les updates du stream
    if (update.agent) {
      const agentMessage = update.agent.messages?.[0];
      if (agentMessage instanceof AIMessage) {
        if (agentMessage.tool_calls && agentMessage.tool_calls.length > 0) {
          for (const tc of agentMessage.tool_calls) {
            yield { type: "tool_start", toolName: tc.name };
          }
        } else if (agentMessage.content) {
          yield { type: "token", content: agentMessage.content as string };
        }
      }
    }
    
    if (update.tools) {
      yield { type: "tool_end" };
    }
  }
  
  yield { type: "complete" };
}

export default propertyAssistantGraph;
