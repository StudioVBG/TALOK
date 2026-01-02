/**
 * Types pour le module RAG
 * SOTA 2026 - Architecture AI-First
 */

// ============================================
// LEGAL DOCUMENTS
// ============================================

export type LegalCategory =
  | "loi_alur"
  | "decret_decence"
  | "bail_type"
  | "charges"
  | "depot_garantie"
  | "conge"
  | "travaux"
  | "assurance"
  | "fiscalite"
  | "copropriete"
  | "edl"
  | "indexation";

export interface LegalDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  category: LegalCategory;
  sourceTitle: string;
  articleReference?: string;
  similarity: number;
}

// ============================================
// USER CONTEXT
// ============================================

export type EntityType = 
  | "property" 
  | "lease" 
  | "tenant" 
  | "invoice" 
  | "ticket" 
  | "document";

export interface UserContextDoc {
  id: string;
  entityType: EntityType;
  entityId: string;
  content: string;
  summary?: string;
  similarity: number;
}

// ============================================
// PLATFORM KNOWLEDGE
// ============================================

export type KnowledgeType =
  | "faq"
  | "tutorial"
  | "best_practice"
  | "template"
  | "glossary"
  | "workflow";

export interface PlatformKnowledge {
  id: string;
  title: string;
  content: string;
  knowledgeType: KnowledgeType;
  similarity: number;
}

// ============================================
// RAG RESULTS
// ============================================

export interface RAGSearchResult {
  legal: LegalDocument[];
  userContext: UserContextDoc[];
  platformKnowledge: PlatformKnowledge[];
}

export interface RAGOptions {
  // Limites par type
  legalLimit?: number;
  contextLimit?: number;
  knowledgeLimit?: number;
  
  // Filtres
  legalCategory?: LegalCategory;
  entityType?: EntityType;
  knowledgeType?: KnowledgeType;
  
  // Seuils
  minSimilarity?: number;
  
  // Mode de recherche
  hybridSearch?: boolean; // Combiner vectoriel + full-text
  vectorWeight?: number;  // Poids du vectoriel dans hybride (0-1)
}

// ============================================
// EMBEDDING
// ============================================

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  tokenCounts: number[];
  totalTokens: number;
}

// ============================================
// INGESTION
// ============================================

export interface LegalDocumentInput {
  content: string;
  category: LegalCategory;
  sourceTitle: string;
  sourceUrl?: string;
  sourceDate?: string;
  articleReference?: string;
  metadata?: Record<string, unknown>;
}

export interface PlatformKnowledgeInput {
  title: string;
  content: string;
  knowledgeType: KnowledgeType;
  targetRoles?: string[];
  slug?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

