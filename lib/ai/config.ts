/**
 * Configuration Centralisée pour les Modèles IA
 * SOTA Décembre 2025 - GPT-5.2 + LangGraph
 * 
 * Ce fichier centralise la configuration des modèles IA
 * pour faciliter la migration vers GPT-5.2 et optimiser les coûts.
 * 
 * GPT-5.2 offre :
 * - Contexte étendu : 400k tokens (vs 128k pour GPT-4o)
 * - Output max : 128k tokens
 * - Cutoff : Août 2025
 * - 3 variantes : Instant, Thinking, Pro
 */

import { ChatOpenAI } from "@langchain/openai";

// ============================================
// TYPES
// ============================================

export type ModelTier = "instant" | "thinking" | "pro";

export interface ModelConfig {
  name: string;
  tier: ModelTier;
  temperature: number;
  maxTokens: number;
  description: string;
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

// ============================================
// CONFIGURATIONS DES MODÈLES
// ============================================

/**
 * Configuration des modèles GPT-5.2 disponibles
 * 
 * GPT-5.2 est disponible en 3 variantes :
 * - instant : Tâches quotidiennes rapides (classification, extraction)
 * - thinking : Raisonnement approfondi (codage, analyse documents)
 * - pro : Précision maximale pour tâches critiques (legal, financier)
 */
export const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  // GPT-5.2 Instant : Tâches rapides quotidiennes
  instant: {
    name: process.env.OPENAI_MODEL_INSTANT || "gpt-5.2-instant",
    tier: "instant",
    temperature: 0,
    maxTokens: 4096,
    description: "GPT-5.2 Instant - Réponses rapides pour tâches simples",
    costPer1kTokens: { input: 0.0003, output: 0.0012 }, // Estimation, à ajuster selon tarifs réels
  },
  
  // GPT-5.2 Thinking : Raisonnement approfondi (par défaut pour l'assistant)
  thinking: {
    name: process.env.OPENAI_MODEL_THINKING || "gpt-5.2-thinking",
    tier: "thinking",
    temperature: 0.3,
    maxTokens: 16384,
    description: "GPT-5.2 Thinking - Raisonnement approfondi pour analyse et codage",
    costPer1kTokens: { input: 0.005, output: 0.02 }, // Estimation, à ajuster selon tarifs réels
  },
  
  // GPT-5.2 Pro : Précision maximale pour tâches critiques
  pro: {
    name: process.env.OPENAI_MODEL_PRO || "gpt-5.2-pro",
    tier: "pro",
    temperature: 0,
    maxTokens: 128000, // Support du contexte étendu de 400k tokens
    description: "GPT-5.2 Pro - Précision maximale pour tâches critiques (legal, financier)",
    costPer1kTokens: { input: 0.01, output: 0.04 }, // Estimation, à ajuster selon tarifs réels
  },
};

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Crée une instance de modèle LLM configurée
 * @param tier - Niveau de performance souhaité
 * @param overrides - Options pour surcharger la config par défaut
 */
export function createModel(
  tier: ModelTier = "thinking",
  overrides?: Partial<{
    temperature: number;
    maxTokens: number;
    streaming: boolean;
  }>
): ChatOpenAI {
  const config = MODEL_CONFIGS[tier];
  
  return new ChatOpenAI({
    modelName: config.name,
    temperature: overrides?.temperature ?? config.temperature,
    maxTokens: overrides?.maxTokens ?? config.maxTokens,
    streaming: overrides?.streaming ?? false,
    
    // GPT-5.2 supporte un contexte étendu jusqu'à 400k tokens
    // Le maxTokens ici contrôle la sortie max (128k pour Pro)
  });
}

/**
 * Crée un modèle GPT-5.2 Instant pour les tâches rapides
 */
export function createInstantModel(streaming = false): ChatOpenAI {
  return createModel("instant", { streaming });
}

/**
 * Crée un modèle GPT-5.2 Thinking pour le raisonnement approfondi (par défaut)
 */
export function createThinkingModel(streaming = false): ChatOpenAI {
  return createModel("thinking", { streaming });
}

/**
 * Crée un modèle GPT-5.2 Pro pour les tâches critiques
 */
export function createProModel(streaming = false): ChatOpenAI {
  return createModel("pro", { streaming });
}

// Aliases pour compatibilité avec l'ancien code
export const createFastModel = createInstantModel;
export const createStandardModel = createThinkingModel;
export const createAdvancedModel = createThinkingModel;
export const createReasoningModel = createProModel;

// ============================================
// UTILITIES
// ============================================

/**
 * Sélectionne automatiquement le tier optimal basé sur la tâche
 * @param taskType - Type de tâche à effectuer
 */
export function selectModelTier(taskType: string): ModelTier {
  const taskMapping: Record<string, ModelTier> = {
    // Tâches rapides → GPT-5.2 Instant
    "classification": "instant",
    "sentiment": "instant",
    "extraction_simple": "instant",
    "translation": "instant",
    "quick_search": "instant",
    
    // Tâches standard → GPT-5.2 Thinking (par défaut)
    "summarization": "thinking",
    "generation": "thinking",
    "chat": "thinking",
    "analysis": "thinking",
    "code_generation": "thinking",
    "multi_step": "thinking",
    "document_analysis": "thinking",
    "property_search": "thinking",
    "ticket_management": "thinking",
    
    // Tâches critiques → GPT-5.2 Pro
    "legal": "pro",
    "financial": "pro",
    "complex_analysis": "pro",
    "contract_review": "pro",
    "invoice_generation": "pro",
    "legal_advice": "pro",
  };
  
  return taskMapping[taskType] || "thinking";
}

/**
 * Estime le coût d'une requête
 * @param tier - Tier du modèle
 * @param inputTokens - Nombre de tokens en entrée
 * @param outputTokens - Nombre de tokens en sortie
 */
export function estimateCost(
  tier: ModelTier,
  inputTokens: number,
  outputTokens: number
): number {
  const config = MODEL_CONFIGS[tier];
  const inputCost = (inputTokens / 1000) * config.costPer1kTokens.input;
  const outputCost = (outputTokens / 1000) * config.costPer1kTokens.output;
  return inputCost + outputCost;
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  configs: MODEL_CONFIGS,
  createModel,
  createInstantModel,
  createThinkingModel,
  createProModel,
  // Aliases pour compatibilité
  createFastModel: createInstantModel,
  createStandardModel: createThinkingModel,
  createAdvancedModel: createThinkingModel,
  createReasoningModel: createProModel,
  selectModelTier,
  estimateCost,
};

