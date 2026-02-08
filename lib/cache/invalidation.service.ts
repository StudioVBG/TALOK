/**
 * Service centralisé d'invalidation de cache
 *
 * Coordonne l'invalidation entre:
 * - React Query (client-side)
 * - Next.js cache tags (server-side)
 * - Supabase realtime (notifications)
 *
 * @module lib/cache/invalidation.service
 */

import { QueryClient } from "@tanstack/react-query";

// Types
export type CacheScope = "owner" | "tenant" | "admin" | "public";
export type EntityType =
  | "property"
  | "lease"
  | "invoice"
  | "payment"
  | "document"
  | "profile"
  | "notification"
  | "ticket"
  | "edl"
  | "signature";

interface InvalidationTarget {
  /** Types d'entités à invalider */
  entities: EntityType[];
  /** IDs spécifiques (optionnel) */
  ids?: string[];
  /** Scopes d'utilisateurs à notifier */
  scopes?: CacheScope[];
  /** Tags Next.js à revalider */
  tags?: string[];
}

// Mapping des entités vers les query keys React Query
const ENTITY_QUERY_KEYS: Record<EntityType, string[]> = {
  property: ["properties", "owner:properties", "owner-properties", "property"],
  lease: ["leases", "owner:leases", "tenant:leases", "lease"],
  invoice: ["invoices", "owner:invoices", "tenant:invoices", "invoice"],
  payment: ["payments", "owner:payments", "tenant:payments", "payment"],
  document: ["documents", "owner:documents", "tenant:documents", "document"],
  profile: ["profiles", "profile", "user"],
  notification: ["notifications", "notification"],
  ticket: ["tickets", "ticket"],
  edl: ["edl", "edl-reports", "edl-report"],
  signature: ["signatures", "lease-signatures", "signature"],
};

// Mapping des entités vers les tags Next.js
const ENTITY_CACHE_TAGS: Record<EntityType, string[]> = {
  property: ["owner:properties", "admin:properties"],
  lease: ["owner:leases", "tenant:leases"],
  invoice: ["owner:invoices", "tenant:invoices"],
  payment: ["owner:payments"],
  document: ["owner:documents"],
  profile: ["profiles"],
  notification: ["notifications"],
  ticket: ["tickets"],
  edl: ["edl-reports"],
  signature: ["signatures"],
};

// Dépendances entre entités (invalidation en cascade)
const ENTITY_DEPENDENCIES: Record<EntityType, EntityType[]> = {
  property: ["lease", "document", "edl"],
  lease: ["invoice", "payment", "signature", "document"],
  invoice: ["payment"],
  payment: [],
  document: [],
  profile: ["property", "lease"],
  notification: [],
  ticket: [],
  edl: [],
  signature: [],
};

/**
 * Classe de service d'invalidation de cache
 */
class CacheInvalidationService {
  private queryClient: QueryClient | null = null;
  private revalidationEndpoint: string = "/api/revalidate";
  private revalidationToken: string | null = null;

  /**
   * Configure le QueryClient React Query
   */
  setQueryClient(client: QueryClient) {
    this.queryClient = client;
  }

  /**
   * Configure le token de revalidation pour les appels API
   */
  setRevalidationToken(token: string) {
    this.revalidationToken = token;
  }

  /**
   * Invalide le cache React Query pour les entités spécifiées
   */
  invalidateReactQuery(target: InvalidationTarget): void {
    if (!this.queryClient) {
      console.warn("[CacheInvalidation] QueryClient not configured");
      return;
    }

    const { entities, ids } = target;

    entities.forEach((entity) => {
      const queryKeys = ENTITY_QUERY_KEYS[entity] || [entity];

      queryKeys.forEach((key) => {
        // Invalider la query générale
        this.queryClient!.invalidateQueries({ queryKey: [key] });

        // Invalider les queries spécifiques si des IDs sont fournis
        if (ids) {
          ids.forEach((id) => {
            this.queryClient!.invalidateQueries({ queryKey: [key, id] });
            this.queryClient!.invalidateQueries({ queryKey: [entity, id] });
          });
        }
      });
    });

    console.log(`[CacheInvalidation] React Query invalidated for: ${entities.join(", ")}`);
  }

  /**
   * Revalide les tags Next.js côté serveur
   */
  async revalidateServerCache(target: InvalidationTarget): Promise<void> {
    const { entities, tags: customTags } = target;

    // Collecter tous les tags à revalider
    const tagsToRevalidate = new Set<string>();

    // Tags des entités
    entities.forEach((entity) => {
      const entityTags = ENTITY_CACHE_TAGS[entity] || [];
      entityTags.forEach((tag) => tagsToRevalidate.add(tag));
    });

    // Tags personnalisés
    if (customTags) {
      customTags.forEach((tag) => tagsToRevalidate.add(tag));
    }

    // Appeler l'API de revalidation pour chaque tag
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.revalidationToken) {
      headers["x-revalidation-token"] = this.revalidationToken;
    }

    const promises = Array.from(tagsToRevalidate).map(async (tag) => {
      try {
        const response = await fetch(`${this.revalidationEndpoint}?tag=${encodeURIComponent(tag)}`, {
          method: "POST",
          headers,
          credentials: "same-origin",
        });

        if (!response.ok) {
          console.warn(`[CacheInvalidation] Failed to revalidate tag: ${tag}`);
        }
      } catch (error) {
        console.error(`[CacheInvalidation] Error revalidating tag ${tag}:`, error);
      }
    });

    await Promise.all(promises);
    console.log(`[CacheInvalidation] Server cache revalidated for tags: ${Array.from(tagsToRevalidate).join(", ")}`);
  }

  /**
   * Invalide le cache avec dépendances en cascade
   */
  async invalidateWithDependencies(
    entity: EntityType,
    ids?: string[],
    options?: {
      includeDependencies?: boolean;
      serverRevalidation?: boolean;
    }
  ): Promise<void> {
    const { includeDependencies = true, serverRevalidation = false } = options || {};

    // Collecter les entités à invalider
    const entitiesToInvalidate = new Set<EntityType>([entity]);

    if (includeDependencies) {
      const dependencies = ENTITY_DEPENDENCIES[entity] || [];
      dependencies.forEach((dep) => entitiesToInvalidate.add(dep));
    }

    const target: InvalidationTarget = {
      entities: Array.from(entitiesToInvalidate),
      ids,
    };

    // Invalider React Query
    this.invalidateReactQuery(target);

    // Revalider le cache serveur si demandé
    if (serverRevalidation) {
      await this.revalidateServerCache(target);
    }
  }

  /**
   * Invalidation après création d'une entité
   */
  async onEntityCreated(entity: EntityType, id: string): Promise<void> {
    await this.invalidateWithDependencies(entity, [id], {
      includeDependencies: false,
      serverRevalidation: true,
    });
  }

  /**
   * Invalidation après mise à jour d'une entité
   */
  async onEntityUpdated(entity: EntityType, id: string): Promise<void> {
    await this.invalidateWithDependencies(entity, [id], {
      includeDependencies: true,
      serverRevalidation: true,
    });
  }

  /**
   * Invalidation après suppression d'une entité
   */
  async onEntityDeleted(entity: EntityType, id: string): Promise<void> {
    await this.invalidateWithDependencies(entity, [id], {
      includeDependencies: true,
      serverRevalidation: true,
    });
  }

  /**
   * Invalidation globale (à utiliser avec parcimonie)
   */
  async invalidateAll(): Promise<void> {
    if (this.queryClient) {
      this.queryClient.invalidateQueries();
    }

    await this.revalidateServerCache({
      entities: Object.keys(ENTITY_QUERY_KEYS) as EntityType[],
    });

    console.log("[CacheInvalidation] All caches invalidated");
  }

  /**
   * Invalidation pour un scope utilisateur spécifique
   */
  invalidateForScope(scope: CacheScope): void {
    if (!this.queryClient) return;

    const scopePrefix = `${scope}:`;

    // Invalider toutes les queries qui commencent par le scope
    this.queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith(scopePrefix);
      },
    });

    console.log(`[CacheInvalidation] Scope ${scope} invalidated`);
  }
}

// Singleton
export const cacheInvalidation = new CacheInvalidationService();

/**
 * Hook pour utiliser le service d'invalidation avec React Query
 */
export function useCacheInvalidation() {
  return {
    invalidate: (entities: EntityType[], ids?: string[]) => {
      cacheInvalidation.invalidateReactQuery({ entities, ids });
    },
    invalidateWithServer: async (entities: EntityType[], ids?: string[]) => {
      cacheInvalidation.invalidateReactQuery({ entities, ids });
      await cacheInvalidation.revalidateServerCache({ entities });
    },
    onCreated: cacheInvalidation.onEntityCreated.bind(cacheInvalidation),
    onUpdated: cacheInvalidation.onEntityUpdated.bind(cacheInvalidation),
    onDeleted: cacheInvalidation.onEntityDeleted.bind(cacheInvalidation),
    invalidateScope: cacheInvalidation.invalidateForScope.bind(cacheInvalidation),
    invalidateAll: cacheInvalidation.invalidateAll.bind(cacheInvalidation),
  };
}

export default cacheInvalidation;
