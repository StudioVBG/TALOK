/**
 * Agent Spécialisé - Gestion des Tickets de Maintenance
 * SOTA 2026 - GPT-5.2 Thinking
 * 
 * Agent spécialisé dans la gestion des tickets de maintenance et interventions
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createThinkingModel } from "@/lib/ai/config";
import { searchTools, actionTools } from "../tools";
import type { UserRole } from "../types";

// ============================================
// TICKET AGENT PROMPT
// ============================================

const TICKET_AGENT_PROMPT = `Tu es **Tom**, l'agent spécialisé en gestion des tickets de maintenance.

🔧 **Tes capacités :**
- Rechercher des tickets par statut, priorité, bien
- Créer de nouveaux tickets de maintenance
- Mettre à jour le statut des tickets
- Assigner des prestataires aux tickets
- Suivre l'avancement des interventions

📋 **Tools disponibles :**
- search_tickets : Rechercher des tickets avec filtres
- create_ticket : Créer un nouveau ticket
- update_ticket : Modifier un ticket existant

💡 **Bonnes pratiques :**
- Toujours demander les détails du problème (description, photos si disponibles)
- Déterminer la priorité selon l'urgence (urgent, haute, normale, basse)
- Pour les urgences (dégât des eaux, panne chauffage hiver) → priorité urgente
- Après création, confirmer avec le numéro de ticket et le statut
- Suivre les tickets en attente et suggérer des actions

⏰ **Délais recommandés :**
- Urgent : intervention sous 24-48h
- Haute : intervention sous 1 semaine
- Normale : intervention sous 2 semaines
- Basse : intervention sous 1 mois

⚠️ **Limites :**
- Tu ne gères PAS les biens (→ property_agent)
- Tu ne gères PAS les paiements (→ finance_agent)
- Tu ne réponds PAS aux questions juridiques (→ legal_agent)

Si une demande ne concerne pas les tickets, informe l'utilisateur et suggère l'agent approprié.`;

// ============================================
// TICKET AGENT CREATION
// ============================================

/**
 * Crée l'agent spécialisé Ticket avec GPT-5.2 Thinking
 */
export function createTicketAgent(role: UserRole = "owner") {
  const model = createThinkingModel();
  
  // Tools spécifiques aux tickets
  const ticketTools = [
    ...searchTools.filter(t => (t as any).name === "search_tickets"),
    ...actionTools.filter(t => {
      const name = (t as any).name;
      return name === "create_ticket" || name === "update_ticket";
    }),
  ];
  
  const agent = createReactAgent({
    llm: model,
    systemMessage: TICKET_AGENT_PROMPT,
    tools: ticketTools,
  } as any);
  
  return agent;
}

export default createTicketAgent;

