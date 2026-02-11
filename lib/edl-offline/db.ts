/**
 * SOTA 2026 — IndexedDB pour le mode hors-ligne EDL
 *
 * Stocke les inspections en cours dans IndexedDB quand le réseau
 * est indisponible. Synchronise automatiquement au retour du réseau.
 *
 * Tables :
 *   - edl_drafts    : EDL en brouillon (données complètes)
 *   - edl_items      : Items inspectés (pièce par pièce)
 *   - edl_photos     : Photos en base64 en attente d'upload
 *   - sync_queue     : File d'attente de synchronisation
 */

const DB_NAME = "talok-edl-offline";
const DB_VERSION = 1;

export interface OfflineEDLDraft {
  id: string;              // UUID local (temporaire)
  lease_id: string;
  property_id: string;
  type: "entree" | "sortie";
  status: "draft" | "in_progress";
  general_notes: string;
  created_at: string;
  updated_at: string;
  synced: boolean;          // false = à synchroniser
  server_id?: string;       // ID côté serveur après sync
}

export interface OfflineEDLItem {
  id: string;
  edl_local_id: string;     // Référence au draft local
  room_name: string;
  item_name: string;
  condition: "bon" | "moyen" | "mauvais" | "tres_mauvais";
  notes: string;
  photo_ids: string[];       // Références vers edl_photos
  synced: boolean;
  server_id?: string;
}

export interface OfflineEDLPhoto {
  id: string;
  edl_local_id: string;
  item_local_id: string;
  base64: string;           // Image en base64
  mime_type: string;
  file_name: string;
  synced: boolean;
  server_path?: string;
}

export interface SyncQueueEntry {
  id: string;
  action: "create_edl" | "create_item" | "upload_photo" | "update_item" | "sign_edl";
  entity_type: string;
  entity_local_id: string;
  payload: unknown;
  status: "pending" | "processing" | "completed" | "failed";
  retry_count: number;
  error?: string;
  created_at: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("edl_drafts")) {
        const store = db.createObjectStore("edl_drafts", { keyPath: "id" });
        store.createIndex("lease_id", "lease_id", { unique: false });
        store.createIndex("synced", "synced", { unique: false });
      }

      if (!db.objectStoreNames.contains("edl_items")) {
        const store = db.createObjectStore("edl_items", { keyPath: "id" });
        store.createIndex("edl_local_id", "edl_local_id", { unique: false });
        store.createIndex("synced", "synced", { unique: false });
      }

      if (!db.objectStoreNames.contains("edl_photos")) {
        const store = db.createObjectStore("edl_photos", { keyPath: "id" });
        store.createIndex("edl_local_id", "edl_local_id", { unique: false });
        store.createIndex("synced", "synced", { unique: false });
      }

      if (!db.objectStoreNames.contains("sync_queue")) {
        const store = db.createObjectStore("sync_queue", { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("created_at", "created_at", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// GENERIC HELPERS
// ============================================

async function putRecord<T>(storeName: string, record: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getRecord<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function getAllByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const index = tx.objectStore(storeName).index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function deleteRecord(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// EDL OFFLINE API
// ============================================

export const edlOfflineDB = {
  // --- DRAFTS ---
  async saveDraft(draft: OfflineEDLDraft): Promise<void> {
    await putRecord("edl_drafts", draft);
  },

  async getDraft(id: string): Promise<OfflineEDLDraft | undefined> {
    return getRecord("edl_drafts", id);
  },

  async getDraftsByLease(leaseId: string): Promise<OfflineEDLDraft[]> {
    return getAllByIndex("edl_drafts", "lease_id", leaseId);
  },

  async getUnsyncedDrafts(): Promise<OfflineEDLDraft[]> {
    return getAllByIndex("edl_drafts", "synced", 0); // IndexedDB stores false as 0
  },

  async deleteDraft(id: string): Promise<void> {
    await deleteRecord("edl_drafts", id);
  },

  // --- ITEMS ---
  async saveItem(item: OfflineEDLItem): Promise<void> {
    await putRecord("edl_items", item);
  },

  async getItem(id: string): Promise<OfflineEDLItem | undefined> {
    return getRecord("edl_items", id);
  },

  async getItemsByEDL(edlLocalId: string): Promise<OfflineEDLItem[]> {
    return getAllByIndex("edl_items", "edl_local_id", edlLocalId);
  },

  async deleteItem(id: string): Promise<void> {
    await deleteRecord("edl_items", id);
  },

  // --- PHOTOS ---
  async savePhoto(photo: OfflineEDLPhoto): Promise<void> {
    await putRecord("edl_photos", photo);
  },

  async getPhoto(id: string): Promise<OfflineEDLPhoto | undefined> {
    return getRecord("edl_photos", id);
  },

  async getPhotosByEDL(edlLocalId: string): Promise<OfflineEDLPhoto[]> {
    return getAllByIndex("edl_photos", "edl_local_id", edlLocalId);
  },

  async deletePhoto(id: string): Promise<void> {
    await deleteRecord("edl_photos", id);
  },

  // --- SYNC QUEUE ---
  async addToSyncQueue(entry: SyncQueueEntry): Promise<void> {
    await putRecord("sync_queue", entry);
  },

  async getPendingSyncEntries(): Promise<SyncQueueEntry[]> {
    return getAllByIndex("sync_queue", "status", "pending");
  },

  async updateSyncEntry(entry: SyncQueueEntry): Promise<void> {
    await putRecord("sync_queue", entry);
  },

  async deleteSyncEntry(id: string): Promise<void> {
    await deleteRecord("sync_queue", id);
  },

  // --- UTILITIES ---
  async clearAll(): Promise<void> {
    const db = await openDB();
    const storeNames = ["edl_drafts", "edl_items", "edl_photos", "sync_queue"];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, "readwrite");
      for (const name of storeNames) {
        tx.objectStore(name).clear();
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getStats(): Promise<{
    drafts: number;
    items: number;
    photos: number;
    pendingSync: number;
  }> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const storeNames = ["edl_drafts", "edl_items", "edl_photos", "sync_queue"];
      const tx = db.transaction(storeNames, "readonly");
      const counts: Record<string, number> = {};

      let completed = 0;
      for (const name of storeNames) {
        const request = tx.objectStore(name).count();
        request.onsuccess = () => {
          counts[name] = request.result;
          completed++;
          if (completed === storeNames.length) {
            resolve({
              drafts: counts.edl_drafts || 0,
              items: counts.edl_items || 0,
              photos: counts.edl_photos || 0,
              pendingSync: counts.sync_queue || 0,
            });
          }
        };
      }
      tx.onerror = () => reject(tx.error);
    });
  },
};
