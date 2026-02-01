/**
 * Service RAG pour les connaissances juridiques
 * SOTA 2026 - Retrieval Augmented Generation
 * 
 * Fournit la recherche sémantique dans les documents
 * juridiques (Loi ALUR, décrets, etc.)
 */

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embeddings.service";
import type {
  LegalDocument,
  LegalCategory,
  PlatformKnowledge,
  KnowledgeType,
  LegalDocumentInput,
  PlatformKnowledgeInput,
} from "./types";

// ============================================
// LEGAL KNOWLEDGE SERVICE
// ============================================

export class LegalKnowledgeService {
  /**
   * Recherche sémantique dans les documents juridiques
   */
  async searchLegalDocs(
    query: string,
    options?: {
      category?: LegalCategory;
      limit?: number;
      minSimilarity?: number;
    }
  ): Promise<LegalDocument[]> {
    const supabase = await createClient();

    // Générer l'embedding de la requête
    const queryEmbedding = await generateEmbedding(query);

    // Appeler la fonction RPC
    const { data, error } = await supabase.rpc("match_legal_documents", {
      query_embedding: queryEmbedding,
      match_count: options?.limit || 5,
      filter_category: options?.category || null,
      min_similarity: options?.minSimilarity || 0.7,
    });

    if (error) {
      console.error("[LegalKnowledge] Search error:", error);
      return [];
    }

    return ((data as any[]) || []).map((doc: any) => ({
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata || {},
      category: doc.category as LegalCategory,
      sourceTitle: doc.source_title,
      articleReference: doc.article_reference,
      similarity: doc.similarity,
    }));
  }

  /**
   * Recherche hybride (vectorielle + full-text)
   * Meilleure précision pour les termes juridiques spécifiques
   */
  async hybridSearchLegal(
    query: string,
    options?: {
      category?: LegalCategory;
      limit?: number;
      vectorWeight?: number;
    }
  ): Promise<LegalDocument[]> {
    const supabase = await createClient();

    const queryEmbedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc("hybrid_search_legal", {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: options?.limit || 5,
      filter_category: options?.category || null,
      vector_weight: options?.vectorWeight || 0.7,
    });

    if (error) {
      console.error("[LegalKnowledge] Hybrid search error:", error);
      // Fallback sur recherche vectorielle simple
      return this.searchLegalDocs(query, options);
    }

    return ((data as any[]) || []).map((doc: any) => ({
      id: doc.id,
      content: doc.content,
      metadata: {},
      category: doc.category as LegalCategory,
      sourceTitle: doc.source_title,
      articleReference: doc.article_reference,
      similarity: doc.combined_score,
    }));
  }

  /**
   * Recherche dans la base de connaissances plateforme
   */
  async searchPlatformKnowledge(
    query: string,
    options?: {
      type?: KnowledgeType;
      role?: string;
      limit?: number;
    }
  ): Promise<PlatformKnowledge[]> {
    const supabase = await createClient();

    const queryEmbedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc("match_platform_knowledge", {
      query_embedding: queryEmbedding,
      match_count: options?.limit || 5,
      filter_type: options?.type || null,
      filter_role: options?.role || null,
    });

    if (error) {
      console.error("[LegalKnowledge] Platform knowledge search error:", error);
      return [];
    }

    return ((data as any[]) || []).map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      knowledgeType: doc.knowledge_type as KnowledgeType,
      similarity: doc.similarity,
    }));
  }

  /**
   * Ajoute un document juridique avec son embedding
   */
  async addLegalDocument(input: LegalDocumentInput): Promise<string | null> {
    const supabase = await createClient();

    // Générer l'embedding
    const embedding = await generateEmbedding(input.content);

    const { data, error } = await supabase
      .from("legal_embeddings")
      .insert({
        content: input.content,
        category: input.category,
        source_title: input.sourceTitle,
        source_url: input.sourceUrl,
        source_date: input.sourceDate,
        article_reference: input.articleReference,
        metadata: input.metadata || {},
        embedding: embedding,
      } as any)
      .select("id")
      .single();

    if (error) {
      console.error("[LegalKnowledge] Insert error:", error);
      return null;
    }

    return (data as any)?.id ?? null;
  }

  /**
   * Ajoute plusieurs documents juridiques en batch
   */
  async addLegalDocumentsBatch(
    inputs: LegalDocumentInput[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Traiter par batch de 10 pour éviter les timeouts
    const batchSize = 10;

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((input) => this.addLegalDocument(input))
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          success++;
        } else {
          failed++;
        }
      }

      // Pause entre les batches pour éviter le rate limiting
      if (i + batchSize < inputs.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { success, failed };
  }

  /**
   * Ajoute une connaissance plateforme
   */
  async addPlatformKnowledge(
    input: PlatformKnowledgeInput
  ): Promise<string | null> {
    const supabase = await createClient();

    const embedding = await generateEmbedding(input.content);

    const { data, error } = await supabase
      .from("platform_knowledge")
      .insert({
        title: input.title,
        content: input.content,
        knowledge_type: input.knowledgeType,
        target_roles: input.targetRoles || ["owner", "tenant", "provider"],
        slug: input.slug,
        priority: input.priority || 0,
        metadata: input.metadata || {},
        embedding: embedding,
      } as any)
      .select("id")
      .single();

    if (error) {
      console.error("[LegalKnowledge] Platform knowledge insert error:", error);
      return null;
    }

    return (data as any)?.id ?? null;
  }

  /**
   * Formate les résultats pour injection dans le prompt
   */
  formatForPrompt(
    legal: LegalDocument[],
    knowledge?: PlatformKnowledge[]
  ): string {
    let context = "";

    if (legal.length > 0) {
      context += "📜 **Références juridiques pertinentes :**\n\n";
      legal.forEach((doc, i) => {
        const ref = doc.articleReference ? ` (${doc.articleReference})` : "";
        context += `**${i + 1}. ${doc.sourceTitle}${ref}**\n`;
        context += `> ${doc.content.substring(0, 600)}${doc.content.length > 600 ? "..." : ""}\n\n`;
      });
    }

    if (knowledge && knowledge.length > 0) {
      context += "\n💡 **Informations complémentaires :**\n\n";
      knowledge.forEach((doc, i) => {
        context += `**${doc.title}**\n`;
        context += `${doc.content.substring(0, 400)}${doc.content.length > 400 ? "..." : ""}\n\n`;
      });
    }

    return context;
  }

  /**
   * Détecte automatiquement la catégorie juridique probable
   */
  detectCategory(query: string): LegalCategory | null {
    const categoryKeywords: Record<LegalCategory, string[]> = {
      loi_alur: ["alur", "loi 2014", "encadrement"],
      decret_decence: ["décence", "décent", "insalubre", "indécent"],
      bail_type: ["bail", "contrat", "meublé", "nu", "mobilité"],
      charges: ["charges", "régularisation", "provisions"],
      depot_garantie: ["dépôt", "garantie", "caution"],
      conge: ["congé", "préavis", "résiliation"],
      travaux: ["travaux", "réparation", "entretien"],
      assurance: ["assurance", "habitation", "risques"],
      fiscalite: ["impôt", "fiscal", "revenus fonciers", "micro-foncier"],
      copropriete: ["copropriété", "syndic", "ag", "assemblée"],
      edl: ["état des lieux", "edl", "inventaire"],
      indexation: ["irl", "indexation", "révision", "augmentation loyer"],
    };

    const lowerQuery = query.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => lowerQuery.includes(kw))) {
        return category as LegalCategory;
      }
    }

    return null;
  }
}

// Singleton
export const legalKnowledge = new LegalKnowledgeService();

export default legalKnowledge;

