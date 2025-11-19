import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// --- State Definition ---
export interface MaintenanceState {
  // Input
  ticketId: string;
  title: string;
  description: string;
  
  // Process State
  urgencyScore?: number; // 1-10
  detectedIssues?: string[]; // ["fuite", "joint", "evier"]
  
  // Output
  suggestedProviderTypes?: string[]; // ["plomberie"]
  suggestedAction?: string; // "Envoyer un plombier d'urgence" vs "Demander au locataire de resserrer le siphon"
  summary?: string;
  priority?: 'basse' | 'normale' | 'haute';
}

// --- Nodes ---

/**
 * Node: Analyze Ticket Content (NLP)
 */
async function analyzeTicket(state: MaintenanceState) {
  console.log(`[AI Maintenance] Analyzing ticket ${state.ticketId}...`);

  try {
    if (process.env.OPENAI_API_KEY) {
      const model = new ChatOpenAI({ 
        modelName: "gpt-4o", 
        temperature: 0,
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const response = await model.invoke([
        new SystemMessage(`Analyze this maintenance request. 
          Return a valid JSON object ONLY with:
          - urgencyScore (1-10)
          - detectedIssues (array of strings)
          - suggestedProviderTypes (array of strings e.g. 'plomberie', 'electricite')
          - suggestedAction (concise action plan)
          - priority ('basse', 'normale', 'haute')
          - summary (short summary of analysis)`),
        new HumanMessage(`Title: ${state.title}\nDescription: ${state.description}`)
      ]);

      const cleanJson = (response.content as string).replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanJson);

      return {
        urgencyScore: result.urgencyScore,
        suggestedProviderTypes: result.suggestedProviderTypes,
        suggestedAction: result.suggestedAction,
        priority: result.priority,
        summary: result.summary
      };
    }
  } catch (error) {
    console.warn("[AI Maintenance] Real AI analysis failed, using fallback.", error);
  }

  // Simulation based on keywords
  const desc = state.description.toLowerCase();
  const title = state.title.toLowerCase();
  
  let urgency = 3;
  let providers: string[] = [];
  let action = "Vérifier lors de la prochaine visite";
  let priority: 'basse' | 'normale' | 'haute' = 'basse';

  if (desc.includes('fuite') || title.includes('fuite') || desc.includes('eau')) {
    urgency = 9;
    providers = ['plomberie'];
    action = "Intervention plombier requise sous 24h. Couper l'arrivée d'eau en attendant.";
    priority = 'haute';
  } else if (desc.includes('electric') || desc.includes('panne') || desc.includes('courant')) {
    urgency = 8;
    providers = ['electricite'];
    action = "Vérifier le tableau électrique. Si persiste, envoyer électricien.";
    priority = 'haute';
  } else if (desc.includes('peinture') || desc.includes('mur')) {
    urgency = 2;
    providers = ['peinture'];
    action = "Planifier des travaux de rafraîchissement.";
    priority = 'basse';
  }

  return {
    urgencyScore: urgency,
    suggestedProviderTypes: providers,
    suggestedAction: action,
    priority: priority,
    summary: `Analyse IA : Urgence ${urgency}/10. Problème détecté : ${providers.join(', ') || 'général'}.`
  };
}

/**
 * Node: Find Providers (Search DB)
 * (This would normally query the vector DB or Postgres with geolocation)
 */
async function findProviders(state: MaintenanceState) {
  // This node just validates that we have providers for the needed type
  // In a real scenario, it would return a list of candidate IDs
  console.log(`[AI Maintenance] Searching for providers type: ${state.suggestedProviderTypes}`);
  return {};
}

// --- Graph Construction ---

const workflow = new StateGraph<MaintenanceState>({
  channels: {
    ticketId: null,
    title: null,
    description: null,
    urgencyScore: null,
    detectedIssues: null,
    suggestedProviderTypes: null,
    suggestedAction: null,
    summary: null,
    priority: null
  }
})
  .addNode("analyze_ticket", analyzeTicket)
  .addNode("find_providers", findProviders)
  .addEdge(START, "analyze_ticket")
  .addEdge("analyze_ticket", "find_providers")
  .addEdge("find_providers", END);

export const maintenanceGraph = workflow.compile();

