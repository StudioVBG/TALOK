/**
 * Pipeline RAG Unifié
 * SOTA 2026 - Orchestration de la recherche augmentée
 * 
 * Combine recherche juridique, contexte utilisateur et
 * connaissances plateforme pour enrichir les réponses IA.
 */

import { legalKnowledge } from "./legal-knowledge.service";
import { userContextService } from "./user-context.service";
import type {
  RAGSearchResult,
  RAGOptions,
  LegalDocument,
  UserContextDoc,
  PlatformKnowledge,
} from "./types";

// ============================================
// RAG PIPELINE
// ============================================

export class RAGPipeline {
  /**
   * Recherche unifiée dans toutes les sources
   */
  async search(
    query: string,
    profileId: string,
    options?: RAGOptions
  ): Promise<RAGSearchResult> {
    const results: RAGSearchResult = {
      legal: [],
      userContext: [],
      platformKnowledge: [],
    };

    // Détection automatique de la catégorie juridique
    const detectedCategory = legalKnowledge.detectCategory(query);

    // Recherches en parallèle pour la performance
    const [legalResults, contextResults, knowledgeResults] = await Promise.all([
      // Recherche juridique
      options?.hybridSearch
        ? legalKnowledge.hybridSearchLegal(query, {
            category: options?.legalCategory || detectedCategory || undefined,
            limit: options?.legalLimit || 3,
            vectorWeight: options?.vectorWeight || 0.7,
          })
        : legalKnowledge.searchLegalDocs(query, {
            category: options?.legalCategory || detectedCategory || undefined,
            limit: options?.legalLimit || 3,
            minSimilarity: options?.minSimilarity || 0.7,
          }),

      // Recherche contexte utilisateur
      userContextService.searchUserContext(query, profileId, {
        entityType: options?.entityType,
        limit: options?.contextLimit || 3,
        minSimilarity: options?.minSimilarity || 0.6,
      }),

      // Recherche connaissances plateforme
      legalKnowledge.searchPlatformKnowledge(query, {
        type: options?.knowledgeType,
        limit: options?.knowledgeLimit || 2,
      }),
    ]);

    results.legal = legalResults;
    results.userContext = contextResults;
    results.platformKnowledge = knowledgeResults;

    return results;
  }

  /**
   * Recherche simplifiée (legal + context seulement)
   */
  async quickSearch(
    query: string,
    profileId: string
  ): Promise<{ legal: LegalDocument[]; userContext: UserContextDoc[] }> {
    const [legal, userContext] = await Promise.all([
      legalKnowledge.searchLegalDocs(query, { limit: 3 }),
      userContextService.searchUserContext(query, profileId, { limit: 2 }),
    ]);

    return { legal, userContext };
  }

  /**
   * Formate les résultats RAG pour injection dans le prompt système
   */
  formatForSystemPrompt(results: RAGSearchResult): string {
    const parts: string[] = [];

    // Section juridique
    if (results.legal.length > 0) {
      parts.push(legalKnowledge.formatForPrompt(results.legal));
    }

    // Section contexte utilisateur
    if (results.userContext.length > 0) {
      parts.push(userContextService.formatForPrompt(results.userContext));
    }

    // Section connaissances plateforme
    if (results.platformKnowledge.length > 0) {
      let knowledgeSection = "💡 **Informations complémentaires :**\n\n";
      results.platformKnowledge.forEach((doc) => {
        knowledgeSection += `**${doc.title}**\n`;
        knowledgeSection += `${doc.content.substring(0, 400)}${doc.content.length > 400 ? "..." : ""}\n\n`;
      });
      parts.push(knowledgeSection);
    }

    if (parts.length === 0) {
      return "";
    }

    return `
---
📚 **CONTEXTE ENRICHI PAR RAG**

${parts.join("\n")}
---

Utilise ces informations pour enrichir ta réponse. Cite les sources juridiques quand tu donnes un conseil légal.
`;
  }

  /**
   * Collecte les sources pour le tracking
   */
  collectSources(results: RAGSearchResult): string[] {
    const sources: string[] = [];

    results.legal.forEach((doc) => {
      const source = doc.articleReference
        ? `${doc.sourceTitle} (${doc.articleReference})`
        : doc.sourceTitle;
      sources.push(`legal:${source}`);
    });

    results.userContext.forEach((doc) => {
      sources.push(`context:${doc.entityType}:${doc.entityId}`);
    });

    results.platformKnowledge.forEach((doc) => {
      sources.push(`knowledge:${doc.title}`);
    });

    return sources;
  }

  /**
   * Enrichit un prompt système avec le contexte RAG
   */
  async enrichSystemPrompt(
    basePrompt: string,
    query: string,
    profileId: string,
    options?: RAGOptions
  ): Promise<{ prompt: string; sources: string[] }> {
    try {
      const results = await this.search(query, profileId, options);
      const ragContext = this.formatForSystemPrompt(results);
      const sources = this.collectSources(results);

      if (!ragContext) {
        return { prompt: basePrompt, sources: [] };
      }

      return {
        prompt: `${basePrompt}\n${ragContext}`,
        sources,
      };
    } catch (error) {
      console.error("[RAG Pipeline] Error enriching prompt:", error);
      // En cas d'erreur, retourner le prompt de base
      return { prompt: basePrompt, sources: [] };
    }
  }
}

// Singleton
export const ragPipeline = new RAGPipeline();

export default ragPipeline;

