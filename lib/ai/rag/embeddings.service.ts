/**
 * Service d'Embeddings
 * SOTA 2026 - OpenAI text-embedding-3-small
 * 
 * Fournit les fonctions de génération d'embeddings
 * pour le RAG et l'indexation des documents.
 */

import { OpenAIEmbeddings } from "@langchain/openai";
import type { EmbeddingResult, BatchEmbeddingResult } from "./types";

// ============================================
// CONFIGURATION
// ============================================

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_BATCH_SIZE = 100; // Limite OpenAI

// ============================================
// SINGLETON
// ============================================

let embeddingsInstance: OpenAIEmbeddings | null = null;

/**
 * Retourne une instance configurée d'OpenAIEmbeddings
 * Utilise le pattern singleton pour réutiliser le client
 */
export function getEmbeddingsClient(): OpenAIEmbeddings {
  if (!embeddingsInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY non configurée");
    }
    
    embeddingsInstance = new OpenAIEmbeddings({
      modelName: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      maxConcurrency: 5, // Limite les appels parallèles
      maxRetries: 3,
    });
  }
  return embeddingsInstance;
}

// ============================================
// FONCTIONS PRINCIPALES
// ============================================

/**
 * Génère un embedding pour un texte unique
 * @param text - Le texte à vectoriser
 * @returns L'embedding (vecteur de 1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Le texte ne peut pas être vide");
  }
  
  const client = getEmbeddingsClient();
  const embedding = await client.embedQuery(text);
  
  return embedding;
}

/**
 * Génère des embeddings pour plusieurs textes
 * Optimisé pour le batch processing
 * @param texts - Les textes à vectoriser
 * @returns Les embeddings correspondants
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }
  
  // Filtrer les textes vides
  const validTexts = texts.filter(t => t && t.trim().length > 0);
  
  if (validTexts.length === 0) {
    return [];
  }
  
  const client = getEmbeddingsClient();
  
  // Si le batch est trop grand, découper
  if (validTexts.length > MAX_BATCH_SIZE) {
    const results: number[][] = [];
    
    for (let i = 0; i < validTexts.length; i += MAX_BATCH_SIZE) {
      const batch = validTexts.slice(i, i + MAX_BATCH_SIZE);
      const batchEmbeddings = await client.embedDocuments(batch);
      results.push(...batchEmbeddings);
    }
    
    return results;
  }
  
  return client.embedDocuments(validTexts);
}

/**
 * Génère un embedding avec métadonnées (token count)
 * @param text - Le texte à vectoriser
 */
export async function generateEmbeddingWithMetadata(
  text: string
): Promise<EmbeddingResult> {
  const embedding = await generateEmbedding(text);
  
  // Estimation du token count (approximatif)
  const tokenCount = Math.ceil(text.length / 4);
  
  return {
    embedding,
    tokenCount,
  };
}

/**
 * Génère des embeddings en batch avec métadonnées
 * @param texts - Les textes à vectoriser
 */
export async function generateEmbeddingsWithMetadata(
  texts: string[]
): Promise<BatchEmbeddingResult> {
  const embeddings = await generateEmbeddings(texts);
  
  const tokenCounts = texts.map(t => Math.ceil(t.length / 4));
  const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);
  
  return {
    embeddings,
    tokenCounts,
    totalTokens,
  };
}

// ============================================
// UTILITAIRES
// ============================================

/**
 * Calcule la similarité cosinus entre deux embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Les embeddings doivent avoir la même dimension");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

/**
 * Formate un embedding pour insertion dans Supabase
 * @param embedding - L'embedding à formater
 * @returns String formatée pour pgvector
 */
export function formatEmbeddingForDB(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Parse un embedding depuis Supabase
 * @param dbEmbedding - L'embedding depuis la DB
 */
export function parseEmbeddingFromDB(dbEmbedding: string | number[]): number[] {
  if (Array.isArray(dbEmbedding)) {
    return dbEmbedding;
  }
  
  // Parse string format "[0.1,0.2,...]"
  const cleaned = dbEmbedding.replace(/[\[\]]/g, "");
  return cleaned.split(",").map(Number);
}

// ============================================
// EXPORTS
// ============================================

export const embeddingsService = {
  getClient: getEmbeddingsClient,
  generate: generateEmbedding,
  generateBatch: generateEmbeddings,
  generateWithMetadata: generateEmbeddingWithMetadata,
  generateBatchWithMetadata: generateEmbeddingsWithMetadata,
  cosineSimilarity,
  formatForDB: formatEmbeddingForDB,
  parseFromDB: parseEmbeddingFromDB,
};

export default embeddingsService;

