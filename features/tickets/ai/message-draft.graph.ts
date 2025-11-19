import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// --- State Definition ---
export interface MessageDraftState {
  // Input
  ticketId?: string;
  threadId?: string;
  messageHistory: { role: string; content: string }[];
  senderRole: 'owner' | 'tenant' | 'admin';
  context?: string; // e.g., "Rent overdue", "Leaking pipe"
  
  // Output
  draftResponse?: string;
  tone?: 'formal' | 'friendly' | 'urgent';
}

// --- Nodes ---

/**
 * Node: Analyze Context & Generate Draft
 */
async function generateDraft(state: MessageDraftState) {
  console.log(`[AI Agent] Generating draft for ${state.senderRole}...`);

  try {
    if (process.env.OPENAI_API_KEY) {
      const model = new ChatOpenAI({ 
        modelName: "gpt-4o", 
        temperature: 0.7,
        apiKey: process.env.OPENAI_API_KEY
      });

      const response = await model.invoke([
        new SystemMessage(`You are a helpful AI assistant for a property management SaaS.
          Draft a professional response for a ${state.senderRole}.
          Tone: ${state.tone || 'professional'}.
          Context: ${state.context || 'General inquiry'}.
          Return ONLY the message body text, no quotes or intro.`),
        new HumanMessage(JSON.stringify(state.messageHistory))
      ]);

      return {
        draftResponse: response.content as string
      };
    }
  } catch (error) {
    console.warn("[AI Agent] Real AI generation failed, using fallback.", error);
  }

  let draft = "";

  // Simulation based on role and context
  if (state.senderRole === 'owner') {
    if (state.context?.includes('fuite')) {
      draft = "Bonjour,\n\nJe vous remercie de m'avoir signalé cette fuite. J'ai bien pris note de l'urgence. Je vais contacter un plombier immédiatement pour intervenir. Pourriez-vous me donner vos disponibilités pour les 48 prochaines heures ?\n\nCordialement,";
    } else if (state.context?.includes('loyer')) {
      draft = "Bonjour,\n\nSauf erreur de ma part, je n'ai pas encore reçu le virement du loyer de ce mois-ci. Pourriez-vous vérifier de votre côté ?\n\nMerci d'avance,";
    } else {
      draft = "Bonjour,\n\nMerci pour votre message. Je reviens vers vous rapidement.\n\nCordialement,";
    }
  } else if (state.senderRole === 'tenant') {
      draft = "Bonjour,\n\nJe vous contacte concernant mon logement. J'aurais besoin de précisions sur ce point. Merci de votre retour.";
  }

  return {
    draftResponse: draft
  };
}

// --- Graph Construction ---

const workflow = new StateGraph<MessageDraftState>({
  channels: {
    ticketId: null,
    threadId: null,
    messageHistory: null,
    senderRole: null,
    context: null,
    draftResponse: null,
    tone: null,
  }
})
  .addNode("generate_draft", generateDraft)
  .addEdge(START, "generate_draft")
  .addEdge("generate_draft", END);

// Compile the graph
export const messageDraftGraph = workflow.compile();

