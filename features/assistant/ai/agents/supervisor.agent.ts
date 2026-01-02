/**
 * Agent Supervisor - Architecture Multi-Agent SOTA 2026
 * 
 * L'agent Supervisor orchestre les agents spécialisés selon le type de tâche.
 * Il utilise GPT-5.2 Thinking pour le raisonnement de routage.
 */

import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createThinkingModel } from "@/lib/ai/config";
import type { UserRole } from "../types";

// ============================================
// SUPERVISOR PROMPT
// ============================================

const SUPERVISOR_PROMPT = `Tu es **Tom**, l'agent Supervisor de l'assistant IA de gestion locative.

🎯 **Ton rôle :**
Tu analyses les demandes des utilisateurs et tu délegues le travail aux agents spécialisés appropriés.

👥 **Agents disponibles :**
1. **property_agent** : Recherche et gestion des biens immobiliers (création, modification, recherche)
2. **finance_agent** : Gestion financière (loyers, factures, paiements, charges)
3. **ticket_agent** : Gestion des tickets de maintenance et interventions
4. **legal_agent** : Questions juridiques et réglementaires (Loi ALUR, baux, droits)

📋 **Instructions de routage :**
- Si la demande concerne des **biens** (recherche, création, modification) → property_agent
- Si la demande concerne des **paiements, factures, loyers, charges** → finance_agent
- Si la demande concerne des **problèmes techniques, maintenance, interventions** → ticket_agent
- Si la demande concerne des **questions juridiques, réglementaires, droits** → legal_agent
- Si la demande nécessite plusieurs agents → commence par le plus prioritaire

💡 **Bonnes pratiques :**
- Analyse bien la demande avant de router
- Si la demande est ambiguë, demande des clarifications à l'utilisateur
- Après avoir délégué, résume les résultats pour l'utilisateur
- Ne fais jamais le travail toi-même, délègue toujours aux agents spécialisés

⚠️ **Important :**
- Tu ne dois JAMAIS exécuter de tools directement
- Tu dois TOUJOURS déléguer aux agents spécialisés
- Réponds uniquement avec le nom de l'agent à appeler (property_agent, finance_agent, ticket_agent, ou legal_agent)`;

// ============================================
// SUPERVISOR AGENT CREATION
// ============================================

/**
 * Crée l'agent Supervisor avec GPT-5.2 Thinking
 */
export function createSupervisorAgent(role: UserRole = "owner") {
  const model = createThinkingModel();
  
  // Le supervisor n'a pas besoin de tools, il route seulement
  const supervisor = createReactAgent({
    model,
    systemMessage: SUPERVISOR_PROMPT,
    tools: [], // Pas de tools pour le supervisor
  });
  
  return supervisor;
}

/**
 * Détermine quel agent spécialisé appeler basé sur la demande
 */
export function routeToAgent(userMessage: string): "property_agent" | "finance_agent" | "ticket_agent" | "legal_agent" {
  const lowerMessage = userMessage.toLowerCase();
  
  // Mots-clés pour chaque agent
  const propertyKeywords = [
    "bien", "propriété", "logement", "appartement", "maison",
    "créer un bien", "modifier un bien", "rechercher un bien",
    "adresse", "surface", "loyer", "type de bien"
  ];
  
  const financeKeywords = [
    "paiement", "facture", "loyer", "charge", "quittance",
    "encaissement", "impayé", "régularisation", "dépôt de garantie",
    "créer une facture", "générer une quittance"
  ];
  
  const ticketKeywords = [
    "ticket", "maintenance", "réparation", "intervention",
    "problème", "panne", "dégât", "fuite", "chauffage",
    "plomberie", "électricité", "créer un ticket"
  ];
  
  const legalKeywords = [
    "loi", "juridique", "droit", "bail", "contrat",
    "alur", "décret", "réglementation", "légal",
    "quels sont mes droits", "que dit la loi", "réglementation"
  ];
  
  // Compter les occurrences de chaque catégorie
  const scores = {
    property: propertyKeywords.filter(kw => lowerMessage.includes(kw)).length,
    finance: financeKeywords.filter(kw => lowerMessage.includes(kw)).length,
    ticket: ticketKeywords.filter(kw => lowerMessage.includes(kw)).length,
    legal: legalKeywords.filter(kw => lowerMessage.includes(kw)).length,
  };
  
  // Retourner l'agent avec le score le plus élevé
  const maxScore = Math.max(scores.property, scores.finance, scores.ticket, scores.legal);
  
  if (maxScore === 0) {
    // Par défaut, utiliser property_agent si aucune correspondance
    return "property_agent";
  }
  
  if (scores.legal === maxScore) return "legal_agent";
  if (scores.finance === maxScore) return "finance_agent";
  if (scores.ticket === maxScore) return "ticket_agent";
  return "property_agent";
}

export default createSupervisorAgent;

