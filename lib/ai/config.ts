/**
 * Configuration Centralisée pour les Modèles IA
 * SOTA Décembre 2025 - GPT-5.1 + LangGraph
 * 
 * Ce fichier centralise la configuration des modèles IA
 * pour faciliter la migration vers GPT-5.1 et optimiser les coûts.
 */

import { ChatOpenAI } from "@langchain/openai";

// ============================================
// TYPES
// ============================================

export type ModelTier = "fast" | "standard" | "advanced" | "reasoning";

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
 * Configuration des modèles disponibles
 * 
 * Note: GPT-5.1 sera utilisé quand disponible dans l'API
 * En attendant, on utilise GPT-4o/GPT-4o-mini
 */
export const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  // Pour les tâches simples (classification, extraction basique)
  fast: {
    name: process.env.OPENAI_MODEL_FAST || "gpt-4o-mini",
    tier: "fast",
    temperature: 0,
    maxTokens: 1024,
    description: "Modèle rapide pour tâches simples",
    costPer1kTokens: { input: 0.00015, output: 0.0006 },
  },
  
  // Pour la plupart des tâches (analyse, génération)
  standard: {
    name: process.env.OPENAI_MODEL_STANDARD || "gpt-4o",
    tier: "standard",
    temperature: 0.3,
    maxTokens: 4096,
    description: "Modèle standard pour la plupart des tâches",
    costPer1kTokens: { input: 0.0025, output: 0.01 },
  },
  
  // Pour les tâches complexes (multi-step, longue réflexion)
  advanced: {
    name: process.env.OPENAI_MODEL_ADVANCED || "gpt-4o",
    tier: "advanced",
    temperature: 0.2,
    maxTokens: 8192,
    description: "Modèle avancé pour tâches complexes",
    costPer1kTokens: { input: 0.0025, output: 0.01 },
  },
  
  // Pour le raisonnement profond (legal, financial)
  // Note: Quand GPT-5.1 sera disponible, utiliser reasoning_effort: "high"
  reasoning: {
    name: process.env.OPENAI_MODEL_REASONING || "gpt-4o",
    tier: "reasoning",
    temperature: 0,
    maxTokens: 16384,
    description: "Modèle avec raisonnement approfondi",
    costPer1kTokens: { input: 0.0025, output: 0.01 },
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
  tier: ModelTier = "standard",
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
    
    // Configuration pour GPT-5.1 (quand disponible):
    // modelName: "gpt-5.1",
    // model_kwargs: {
    //   reasoning_effort: tier === "reasoning" ? "high" : "auto",
    // },
  });
}

/**
 * Crée un modèle rapide pour les tâches simples
 */
export function createFastModel(streaming = false): ChatOpenAI {
  return createModel("fast", { streaming });
}

/**
 * Crée un modèle standard pour la plupart des usages
 */
export function createStandardModel(streaming = false): ChatOpenAI {
  return createModel("standard", { streaming });
}

/**
 * Crée un modèle avancé pour les tâches complexes
 */
export function createAdvancedModel(streaming = false): ChatOpenAI {
  return createModel("advanced", { streaming });
}

/**
 * Crée un modèle avec raisonnement approfondi
 */
export function createReasoningModel(): ChatOpenAI {
  return createModel("reasoning");
}

// ============================================
// UTILITIES
// ============================================

/**
 * Sélectionne automatiquement le tier optimal basé sur la tâche
 * @param taskType - Type de tâche à effectuer
 */
export function selectModelTier(taskType: string): ModelTier {
  const taskMapping: Record<string, ModelTier> = {
    // Tâches rapides
    "classification": "fast",
    "sentiment": "fast",
    "extraction_simple": "fast",
    "translation": "fast",
    
    // Tâches standard
    "summarization": "standard",
    "generation": "standard",
    "chat": "standard",
    "analysis": "standard",
    
    // Tâches avancées
    "code_generation": "advanced",
    "multi_step": "advanced",
    "document_analysis": "advanced",
    
    // Raisonnement
    "legal": "reasoning",
    "financial": "reasoning",
    "complex_analysis": "reasoning",
  };
  
  return taskMapping[taskType] || "standard";
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
  createFastModel,
  createStandardModel,
  createAdvancedModel,
  createReasoningModel,
  selectModelTier,
  estimateCost,
};

