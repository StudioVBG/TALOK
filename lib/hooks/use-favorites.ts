"use client";

/**
 * Hook pour gérer les favoris/épingles
 * Stocke les favoris dans localStorage pour une persistance simple
 */

import { useState, useEffect, useCallback } from "react";

export type FavoriteType = "property" | "lease" | "tenant" | "document" | "ticket";

export interface FavoriteItem {
  id: string;
  type: FavoriteType;
  label: string;
  description?: string;
  href: string;
  addedAt: string;
}

interface UseFavoritesReturn {
  /** Liste des favoris */
  favorites: FavoriteItem[];
  /** Ajouter un favori */
  addFavorite: (item: Omit<FavoriteItem, "addedAt">) => void;
  /** Retirer un favori */
  removeFavorite: (id: string, type: FavoriteType) => void;
  /** Toggle favori */
  toggleFavorite: (item: Omit<FavoriteItem, "addedAt">) => void;
  /** Vérifier si un élément est en favori */
  isFavorite: (id: string, type: FavoriteType) => boolean;
  /** Obtenir les favoris par type */
  getFavoritesByType: (type: FavoriteType) => FavoriteItem[];
  /** Nombre total de favoris */
  count: number;
}

const STORAGE_KEY = "gestion_locative_favorites";

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger les favoris depuis localStorage au montage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setFavorites(JSON.parse(stored));
        }
      } catch (error) {
        console.error("[useFavorites] Erreur lecture localStorage:", error);
      }
      setIsLoaded(true);
    }
  }, []);

  // Sauvegarder dans localStorage à chaque changement
  useEffect(() => {
    if (isLoaded && typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch (error) {
        console.error("[useFavorites] Erreur sauvegarde localStorage:", error);
      }
    }
  }, [favorites, isLoaded]);

  const addFavorite = useCallback((item: Omit<FavoriteItem, "addedAt">) => {
    setFavorites((prev) => {
      // Vérifier si déjà en favori
      const exists = prev.some((f) => f.id === item.id && f.type === item.type);
      if (exists) return prev;

      return [
        ...prev,
        {
          ...item,
          addedAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

  const removeFavorite = useCallback((id: string, type: FavoriteType) => {
    setFavorites((prev) => prev.filter((f) => !(f.id === id && f.type === type)));
  }, []);

  const toggleFavorite = useCallback((item: Omit<FavoriteItem, "addedAt">) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === item.id && f.type === item.type);
      if (exists) {
        return prev.filter((f) => !(f.id === item.id && f.type === item.type));
      }
      return [
        ...prev,
        {
          ...item,
          addedAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

  const isFavorite = useCallback(
    (id: string, type: FavoriteType) => {
      return favorites.some((f) => f.id === id && f.type === type);
    },
    [favorites]
  );

  const getFavoritesByType = useCallback(
    (type: FavoriteType) => {
      return favorites.filter((f) => f.type === type);
    },
    [favorites]
  );

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    getFavoritesByType,
    count: favorites.length,
  };
}

export default useFavorites;

