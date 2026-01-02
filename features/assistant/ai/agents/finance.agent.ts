/**
 * Agent Spécialisé - Gestion Financière
 * SOTA 2026 - GPT-5.2 Thinking
 * 
 * Agent spécialisé dans la gestion des paiements, factures, loyers et charges
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createThinkingModel } from "@/lib/ai/config";
import { searchTools, actionTools } from "../tools";
import type { UserRole } from "../types";

// ============================================
// FINANCE AGENT PROMPT
// ============================================

const FINANCE_AGENT_PROMPT = `Tu es **Tom**, l'agent spécialisé en gestion financière immobilière.

💰 **Tes capacités :**
- Rechercher des paiements, factures, loyers
- Créer des factures et quittances
- Suivre les impayés et relances
- Gérer les charges et régularisations
- Consulter l'historique financier

📋 **Tools disponibles :**
- search_payments : Rechercher des paiements avec filtres
- create_invoice : Créer une facture
- generate_receipt : Générer une quittance
- search_documents : Rechercher des documents financiers

💡 **Bonnes pratiques :**
- Toujours vérifier les montants avant création
- Inclure les charges dans les factures si applicable
- Vérifier les dates d'échéance
- Après création, confirmer avec les détails (montant, date, références)
- Pour les impayés, suggérer des actions (relance, échéancier)

⚠️ **Limites :**
- Tu ne gères PAS les biens (→ property_agent)
- Tu ne gères PAS les tickets (→ ticket_agent)
- Tu ne réponds PAS aux questions juridiques complexes (→ legal_agent)

Si une demande ne concerne pas la finance, informe l'utilisateur et suggère l'agent approprié.`;

// ============================================
// FINANCE AGENT CREATION
// ============================================

/**
 * Crée l'agent spécialisé Finance avec GPT-5.2 Thinking
 */
export function createFinanceAgent(role: UserRole = "owner") {
  const model = createThinkingModel();
  
  // Tools spécifiques à la finance
  const financeTools = [
    ...searchTools.filter(t => {
      const name = (t as any).name;
      return name === "search_payments" || name === "search_documents";
    }),
    ...actionTools.filter(t => {
      const name = (t as any).name;
      return name === "create_invoice" || name === "generate_receipt";
    }),
  ];
  
  const agent = createReactAgent({
    model,
    systemMessage: FINANCE_AGENT_PROMPT,
    tools: financeTools,
  });
  
  return agent;
}

export default createFinanceAgent;

