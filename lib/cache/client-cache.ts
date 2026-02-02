"use client";

/**
 * Service de cache côté client avec support localStorage et mémoire
 * Utile pour persister des données entre les sessions
 */

interface CacheItem<T> {
  data: T;
  expiry: number;
  version: number;
}

// Version du cache - incrémenter pour invalider le cache après un déploiement
const CACHE_VERSION = 1;

/**
 * Cache en mémoire (plus rapide, non persistant)
 */
class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (item.expiry < Date.now() || item.version !== CACHE_VERSION) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
      version: CACHE_VERSION,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

/**
 * Cache persistant (localStorage)
 */
class PersistentCache {
  private prefix = "gl_cache_";

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  get<T>(key: string): T | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(this.getKey(key));
      if (!stored) return null;

      const item: CacheItem<T> = JSON.parse(stored);
      
      if (item.expiry < Date.now() || item.version !== CACHE_VERSION) {
        this.delete(key);
        return null;
      }

      return item.data;
    } catch {
      return null;
    }
  }

  set<T>(key: string, data: T, ttlMs: number = 24 * 60 * 60 * 1000): void {
    if (typeof window === "undefined") return;

    try {
      const item: CacheItem<T> = {
        data,
        expiry: Date.now() + ttlMs,
        version: CACHE_VERSION,
      };
      localStorage.setItem(this.getKey(key), JSON.stringify(item));
    } catch (e) {
      // localStorage peut être plein ou désactivé
      console.warn("[Cache] Impossible d'écrire dans localStorage:", e);
    }
  }

  delete(key: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.getKey(key));
  }

  clear(): void {
    if (typeof window === "undefined") return;
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// Instances singleton
export const memoryCache = new MemoryCache();
export const persistentCache = new PersistentCache();

/**
 * Cache hybride : mémoire + localStorage
 * La mémoire sert de cache L1 (rapide), localStorage de cache L2 (persistant)
 */
export const hybridCache = {
  get<T>(key: string): T | null {
    // D'abord vérifier le cache mémoire
    const memoryResult = memoryCache.get<T>(key);
    if (memoryResult !== null) return memoryResult;

    // Sinon, vérifier localStorage et repeupler la mémoire
    const persistentResult = persistentCache.get<T>(key);
    if (persistentResult !== null) {
      memoryCache.set(key, persistentResult);
    }
    return persistentResult;
  },

  set<T>(key: string, data: T, options: { memoryTtl?: number; persistTtl?: number } = {}): void {
    const { memoryTtl = 5 * 60 * 1000, persistTtl = 24 * 60 * 60 * 1000 } = options;
    memoryCache.set(key, data, memoryTtl);
    persistentCache.set(key, data, persistTtl);
  },

  delete(key: string): void {
    memoryCache.delete(key);
    persistentCache.delete(key);
  },

  clear(): void {
    memoryCache.clear();
    persistentCache.clear();
  },
};

/**
 * Decorator pour cacher le résultat d'une fonction async
 */
export function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  options: { ttlMs?: number; persistent?: boolean } = {}
): () => Promise<T> {
  const { ttlMs = 5 * 60 * 1000, persistent = false } = options;
  const cache = persistent ? hybridCache : memoryCache;

  return async () => {
    const cached = cache.get<T>(key);
    if (cached !== null) return cached;

    const result = await fn();
    cache.set(key, result, (persistent ? { memoryTtl: ttlMs, persistTtl: ttlMs } : ttlMs) as any);
    return result;
  };
}

/**
 * Hook-friendly cache key generator
 */
export function createCacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts.filter(Boolean).join(":");
}

export default hybridCache;


