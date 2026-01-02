/**
 * Agent Spécialisé - Questions Juridiques et RAG Legal
 * SOTA 2026 - GPT-5.2 Pro + RAG
 * 
 * Agent spécialisé dans les questions juridiques avec accès au RAG Legal (Loi ALUR, etc.)
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createProModel } from "@/lib/ai/config";
import { legalKnowledge } from "@/lib/ai/rag/legal-knowledge.service";
import type { UserRole } from "../types";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ============================================
// LEGAL RAG TOOL
// ============================================

const searchLegalRAGTool = tool(
  async (input: { query: string; category?: string }) => {
    const { query, category } = input;
    
    // Recherche dans le RAG Legal
    const results = await legalKnowledge.searchLegalDocs(query, {
      category: category as any,
      limit: 5,
      minSimilarity: 0.7,
    });
    
    // Formater les résultats pour l'agent
    if (results.length === 0) {
      return "Aucun document juridique trouvé pour cette question.";
    }
    
    return legalKnowledge.formatForPrompt(results);
  },
  {
    name: "search_legal_rag",
    description: `Recherche dans la base de connaissances juridiques (Loi ALUR, décrets, réglementations).
    Utilise ce tool pour répondre aux questions juridiques sur la gestion locative en France.`,
    schema: z.object({
      query: z.string().describe("La question juridique à rechercher"),
      category: z.string().optional().describe("Catégorie optionnelle (loi_alur, bail_type, charges, etc.)"),
    }),
  }
);

// ============================================
// LEGAL AGENT PROMPT
// ============================================

const LEGAL_AGENT_PROMPT = `Tu es **Tom**, l'agent spécialisé en questions juridiques immobilières.

⚖️ **Tes capacités :**
- Répondre aux questions sur la Loi ALUR et la réglementation locative
- Expliquer les droits et obligations des propriétaires et locataires
- Conseiller sur les baux, charges, dépôts de garantie, congés
- Fournir des références légales précises (articles, décrets)

📋 **Tools disponibles :**
- search_legal_rag : Recherche dans la base de connaissances juridiques (Loi ALUR, décrets, etc.)

💡 **Bonnes pratiques :**
- TOUJOURS utiliser search_legal_rag avant de répondre à une question juridique
- Citer les articles de loi et références précises
- Expliquer de manière claire et pédagogique
- Distinguer les obligations légales des bonnes pratiques
- Pour les cas complexes, recommander de consulter un avocat spécialisé

📜 **Domaines couverts :**
- Loi ALUR (encadrement des loyers, baux, etc.)
- Types de baux (nu, meublé, mobilité, saisonnier)
- Charges et régularisations
- Dépôt de garantie
- Congés et préavis
- Travaux et réparations
- Assurance habitation
- Fiscalité immobilière

⚠️ **Limites importantes :**
- Tu ne donnes PAS de conseil juridique personnalisé pour des litiges complexes
- Tu ne remplaces PAS un avocat pour les cas litigieux
- Tu ne gères PAS les biens (→ property_agent)
- Tu ne gères PAS les paiements (→ finance_agent)
- Tu ne gères PAS les tickets (→ ticket_agent)

Si une demande ne concerne pas le juridique, informe l'utilisateur et suggère l'agent approprié.`;

// ============================================
// LEGAL AGENT CREATION
// ============================================

/**
 * Crée l'agent spécialisé Legal avec GPT-5.2 Pro (pour précision maximale)
 */
export function createLegalAgent(role: UserRole = "owner") {
  const model = createProModel(); // GPT-5.2 Pro pour précision maximale
  
  const agent = createReactAgent({
    model,
    systemMessage: LEGAL_AGENT_PROMPT,
    tools: [searchLegalRAGTool],
  });
  
  return agent;
}

export default createLegalAgent;

