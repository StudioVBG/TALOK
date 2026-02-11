/**
 * SOTA 2026 — Hook React pour la gestion EDL hors-ligne
 *
 * Fournit une API unifiée pour les composants EDL :
 *   - Détecte automatiquement le mode online/offline
 *   - Sauvegarde dans IndexedDB quand offline
 *   - Synchronise automatiquement au retour du réseau
 *   - Expose la progression de la synchronisation
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  edlOfflineDB,
  type OfflineEDLDraft,
  type OfflineEDLItem,
  type OfflineEDLPhoto,
} from "./db";
import { syncOfflineData, type SyncProgress } from "./sync";

export interface UseOfflineEDLReturn {
  /** true si le navigateur est hors-ligne */
  isOffline: boolean;
  /** true si une synchronisation est en cours */
  isSyncing: boolean;
  /** Progression de la synchronisation */
  syncProgress: SyncProgress | null;
  /** Nombre d'éléments en attente de sync */
  pendingCount: number;
  /** Sauvegarder un draft EDL localement */
  saveDraft: (draft: OfflineEDLDraft) => Promise<void>;
  /** Sauvegarder un item inspecté localement */
  saveItem: (item: OfflineEDLItem) => Promise<void>;
  /** Sauvegarder une photo localement (base64) */
  savePhoto: (photo: OfflineEDLPhoto) => Promise<void>;
  /** Récupérer les items d'un EDL local */
  getItems: (edlLocalId: string) => Promise<OfflineEDLItem[]>;
  /** Récupérer les photos d'un EDL local */
  getPhotos: (edlLocalId: string) => Promise<OfflineEDLPhoto[]>;
  /** Déclencher la synchronisation manuellement */
  triggerSync: () => Promise<void>;
  /** Vider toutes les données locales */
  clearLocal: () => Promise<void>;
  /** Statistiques du stockage local */
  stats: { drafts: number; items: number; photos: number; pendingSync: number } | null;
}

export function useOfflineEDL(): UseOfflineEDLReturn {
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [stats, setStats] = useState<UseOfflineEDLReturn["stats"]>(null);
  const syncingRef = useRef(false);

  // Détecter le mode online/offline
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      // Auto-sync au retour en ligne
      triggerSyncInternal();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Charger les stats initiales
    refreshStats();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const s = await edlOfflineDB.getStats();
      setStats(s);
      setPendingCount(s.drafts + s.items + s.photos);
    } catch {
      // IndexedDB pas disponible (SSR ou navigateur non supporté)
    }
  }, []);

  const triggerSyncInternal = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      await syncOfflineData((progress) => {
        setSyncProgress(progress);
      });
    } catch (err) {
      console.error("[useOfflineEDL] Sync error:", err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      setSyncProgress(null);
      await refreshStats();
    }
  }, [refreshStats]);

  const saveDraft = useCallback(async (draft: OfflineEDLDraft) => {
    await edlOfflineDB.saveDraft(draft);
    await refreshStats();
  }, [refreshStats]);

  const saveItem = useCallback(async (item: OfflineEDLItem) => {
    await edlOfflineDB.saveItem(item);
    await refreshStats();
  }, [refreshStats]);

  const savePhoto = useCallback(async (photo: OfflineEDLPhoto) => {
    await edlOfflineDB.savePhoto(photo);
    await refreshStats();
  }, [refreshStats]);

  const getItems = useCallback(async (edlLocalId: string) => {
    return edlOfflineDB.getItemsByEDL(edlLocalId);
  }, []);

  const getPhotos = useCallback(async (edlLocalId: string) => {
    return edlOfflineDB.getPhotosByEDL(edlLocalId);
  }, []);

  const triggerSync = useCallback(async () => {
    await triggerSyncInternal();
  }, [triggerSyncInternal]);

  const clearLocal = useCallback(async () => {
    await edlOfflineDB.clearAll();
    await refreshStats();
  }, [refreshStats]);

  return {
    isOffline,
    isSyncing,
    syncProgress,
    pendingCount,
    saveDraft,
    saveItem,
    savePhoto,
    getItems,
    getPhotos,
    triggerSync,
    clearLocal,
    stats,
  };
}
