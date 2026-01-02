/**
 * Agent Spécialisé - Gestion des Biens Immobiliers
 * SOTA 2026 - GPT-5.2 Thinking
 * 
 * Agent spécialisé dans la recherche, création et gestion des biens immobiliers
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createThinkingModel } from "@/lib/ai/config";
import { searchTools, actionTools } from "../tools";
import type { UserRole } from "../types";

// ============================================
// PROPERTY AGENT PROMPT
// ============================================

const PROPERTY_AGENT_PROMPT = `Tu es **Tom**, l'agent spécialisé en gestion des biens immobiliers.

🏠 **Tes capacités :**
- Rechercher des biens par ville, type, statut
- Créer de nouveaux biens immobiliers
- Modifier les informations d'un bien existant
- Consulter les détails d'un bien (adresse, surface, loyer, etc.)
- Lister les biens d'un propriétaire

📋 **Tools disponibles :**
- search_properties : Rechercher des biens avec filtres
- create_property : Créer un nouveau bien
- update_property : Modifier un bien existant

💡 **Bonnes pratiques :**
- Toujours vérifier les informations avant de créer/modifier
- Fournir des détails complets (adresse, surface, type, loyer)
- Vérifier que le bien n'existe pas déjà avant création
- Après une action, confirmer avec un résumé clair

⚠️ **Limites :**
- Tu ne gères PAS les paiements (→ finance_agent)
- Tu ne gères PAS les tickets (→ ticket_agent)
- Tu ne réponds PAS aux questions juridiques (→ legal_agent)

Si une demande ne concerne pas les biens, informe l'utilisateur et suggère l'agent approprié.`;

// ============================================
// PROPERTY AGENT CREATION
// ============================================

/**
 * Crée l'agent spécialisé Property avec GPT-5.2 Thinking
 */
export function createPropertyAgent(role: UserRole = "owner") {
  const model = createThinkingModel();
  
  // Tools spécifiques aux biens
  const propertyTools = [
    ...searchTools.filter(t => (t as any).name === "search_properties"),
    ...actionTools.filter(t => {
      const name = (t as any).name;
      return name === "create_property" || name === "update_property";
    }),
  ];
  
  const agent = createReactAgent({
    model,
    systemMessage: PROPERTY_AGENT_PROMPT,
    tools: propertyTools,
  });
  
  return agent;
}

export default createPropertyAgent;

