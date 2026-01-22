/**
 * Service de cache LRU pour les données de quittances
 * SOTA 2026 - Optimisation des performances
 *
 * Utilise un cache en mémoire avec TTL pour réduire les appels DB
 * sur les données fréquemment accédées (quittances récentes, factures)
 */

import type { ReceiptData } from "./receipt-generator";

// ============================================
// TYPES
// ============================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccess: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
}

interface CacheOptions {
  /** Taille maximale du cache (nombre d'entrées) */
  maxSize: number;
  /** Durée de vie en millisecondes */
  ttl: number;
  /** Nom du cache pour les logs */
  name: string;
}

// ============================================
// LRU CACHE IMPLEMENTATION
// ============================================

/**
 * Cache LRU (Least Recently Used) avec TTL
 * Thread-safe pour environnement Node.js single-threaded
 */
export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly name: string;
  private stats: CacheStats;

  constructor(options: CacheOptions) {
    this.cache = new Map();
    this.maxSize = options.maxSize;
    this.ttl = options.ttl;
    this.name = options.name;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize: options.maxSize,
    };
  }

  /**
   * Récupère une valeur du cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Vérifier expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size--;
      return undefined;
    }

    // Mettre à jour les stats d'accès (LRU)
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.stats.hits++;

    // Réinsérer pour maintenir l'ordre LRU (Map préserve l'ordre d'insertion)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Stocke une valeur dans le cache
   */
  set(key: K, value: V, customTtl?: number): void {
    // Supprimer l'ancienne entrée si elle existe
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.stats.size--;
    }

    // Éviction si cache plein
    while (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<V> = {
      value,
      expiresAt: Date.now() + (customTtl ?? this.ttl),
      accessCount: 1,
      lastAccess: Date.now(),
    };

    this.cache.set(key, entry);
    this.stats.size++;
  }

  /**
   * Supprime une entrée du cache
   */
  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size--;
    }
    return deleted;
  }

  /**
   * Vérifie si une clé existe et n'est pas expirée
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size--;
      return false;
    }

    return true;
  }

  /**
   * Vide le cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Retourne les statistiques du cache
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Éviction de l'entrée la moins récemment utilisée
   */
  private evictLRU(): void {
    // La première entrée de la Map est la plus ancienne (LRU)
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
      this.stats.size--;
    }
  }

  /**
   * Nettoie les entrées expirées (à appeler périodiquement)
   */
  prune(): number {
    let pruned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
        this.stats.size--;
      }
    }

    return pruned;
  }
}

// ============================================
// CACHE INSTANCES - QUITTANCES
// ============================================

/** Cache pour les données de quittances (5 min TTL, 500 entrées max) */
export const receiptDataCache = new LRUCache<string, ReceiptData>({
  maxSize: 500,
  ttl: 5 * 60 * 1000, // 5 minutes
  name: "receipt-data",
});

/** Cache pour les PDFs générés (30 min TTL, 100 entrées max) */
export const receiptPdfCache = new LRUCache<string, Uint8Array>({
  maxSize: 100,
  ttl: 30 * 60 * 1000, // 30 minutes
  name: "receipt-pdf",
});

/** Cache pour les factures (2 min TTL, 1000 entrées max) */
export const invoiceCache = new LRUCache<string, unknown>({
  maxSize: 1000,
  ttl: 2 * 60 * 1000, // 2 minutes
  name: "invoice",
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Génère une clé de cache pour une quittance
 */
export function getReceiptCacheKey(invoiceId: string, paymentId?: string): string {
  return paymentId ? `receipt:${invoiceId}:${paymentId}` : `receipt:${invoiceId}`;
}

/**
 * Génère une clé de cache pour un PDF
 */
export function getPdfCacheKey(receiptId: string): string {
  return `pdf:${receiptId}`;
}

/**
 * Génère une clé de cache pour une facture
 */
export function getInvoiceCacheKey(invoiceId: string): string {
  return `invoice:${invoiceId}`;
}

/**
 * Invalide le cache pour une facture et ses quittances associées
 */
export function invalidateInvoiceCache(invoiceId: string): void {
  invoiceCache.delete(getInvoiceCacheKey(invoiceId));

  // Note: On ne peut pas itérer facilement sur les clés avec préfixe
  // Pour une invalidation complète, on pourrait stocker les associations
  receiptDataCache.delete(getReceiptCacheKey(invoiceId));
}

/**
 * Récupère ou calcule une valeur avec mise en cache
 */
export async function getOrSet<T>(
  cache: LRUCache<string, T>,
  key: string,
  fetchFn: () => Promise<T>,
  customTtl?: number
): Promise<T> {
  // Vérifier le cache
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  // Récupérer la valeur
  const value = await fetchFn();

  // Mettre en cache
  cache.set(key, value, customTtl);

  return value;
}

// ============================================
// CLEANUP AUTOMATIQUE
// ============================================

// Nettoyer les entrées expirées toutes les 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    receiptDataCache.prune();
    receiptPdfCache.prune();
    invoiceCache.prune();
  }, 5 * 60 * 1000);
}

// ============================================
// EXPORT STATS POUR MONITORING
// ============================================

/**
 * Retourne les statistiques de tous les caches
 */
export function getAllCacheStats(): Record<string, ReturnType<LRUCache<unknown, unknown>["getStats"]>> {
  return {
    "receipt-data": receiptDataCache.getStats(),
    "receipt-pdf": receiptPdfCache.getStats(),
    invoice: invoiceCache.getStats(),
  };
}
