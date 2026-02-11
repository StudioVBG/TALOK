/**
 * SOTA 2026 — Service de synchronisation EDL hors-ligne
 *
 * Gère la file d'attente de synchronisation :
 *   1. Détecte le retour en ligne
 *   2. Traite les entrées de la sync queue dans l'ordre
 *   3. Upload les photos d'abord, puis crée les items, puis l'EDL
 *   4. Gère les erreurs et retries
 */

import {
  edlOfflineDB,
  type SyncQueueEntry,
  type OfflineEDLDraft,
  type OfflineEDLItem,
  type OfflineEDLPhoto,
} from "./db";

const MAX_RETRIES = 3;

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  current: string | null;
}

type ProgressCallback = (progress: SyncProgress) => void;

/**
 * Synchronise toutes les données EDL hors-ligne avec le serveur.
 */
export async function syncOfflineData(
  onProgress?: ProgressCallback
): Promise<{ success: boolean; synced: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  // 1. Récupérer les drafts non synchronisés
  const drafts = await edlOfflineDB.getUnsyncedDrafts();

  const total = drafts.length;
  const progress: SyncProgress = { total, completed: 0, failed: 0, current: null };

  for (const draft of drafts) {
    progress.current = `Synchronisation EDL ${draft.type}...`;
    onProgress?.(progress);

    try {
      // a. Créer l'EDL sur le serveur
      const serverId = await syncDraft(draft);
      if (!serverId) {
        throw new Error("Impossible de créer l'EDL sur le serveur");
      }

      // b. Synchroniser les items
      const items = await edlOfflineDB.getItemsByEDL(draft.id);
      for (const item of items) {
        // Upload les photos de cet item d'abord
        const photos = await Promise.all(
          item.photo_ids.map((pid) => edlOfflineDB.getPhoto(pid))
        );

        const uploadedPaths: string[] = [];
        for (const photo of photos) {
          if (!photo) continue;
          const path = await syncPhoto(photo, serverId);
          if (path) {
            uploadedPaths.push(path);
            photo.synced = true;
            photo.server_path = path;
            await edlOfflineDB.savePhoto(photo);
          }
        }

        // Puis créer l'item
        await syncItem(item, serverId, uploadedPaths);
        item.synced = true;
        await edlOfflineDB.saveItem(item);
      }

      // c. Marquer le draft comme synchronisé
      draft.synced = true;
      draft.server_id = serverId;
      await edlOfflineDB.saveDraft(draft);

      synced++;
      progress.completed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      errors.push(`EDL ${draft.id}: ${message}`);
      failed++;
      progress.failed++;
    }

    onProgress?.(progress);
  }

  // 2. Traiter la sync queue restante
  const pendingEntries = await edlOfflineDB.getPendingSyncEntries();
  for (const entry of pendingEntries) {
    try {
      await processSyncEntry(entry);
      entry.status = "completed";
      await edlOfflineDB.updateSyncEntry(entry);
      synced++;
    } catch (err) {
      entry.retry_count++;
      if (entry.retry_count >= MAX_RETRIES) {
        entry.status = "failed";
        entry.error = err instanceof Error ? err.message : "Erreur";
      }
      await edlOfflineDB.updateSyncEntry(entry);
      failed++;
    }
  }

  return { success: failed === 0, synced, failed, errors };
}

async function syncDraft(draft: OfflineEDLDraft): Promise<string | null> {
  const response = await fetch("/api/edl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lease_id: draft.lease_id,
      type: draft.type,
      general_notes: draft.general_notes,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    // Si l'EDL existe déjà (409), on récupère l'ID existant
    if (response.status === 409 || error.edl?.id) {
      return error.edl?.id || null;
    }
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.edl?.id || null;
}

async function syncItem(
  item: OfflineEDLItem,
  serverEdlId: string,
  photoPaths: string[]
): Promise<void> {
  const response = await fetch(`/api/edl/${serverEdlId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room_name: item.room_name,
      item_name: item.item_name,
      condition: item.condition,
      notes: item.notes,
      photo_paths: photoPaths,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

async function syncPhoto(
  photo: OfflineEDLPhoto,
  serverEdlId: string
): Promise<string | null> {
  const response = await fetch(`/api/edl/${serverEdlId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base64: photo.base64,
      mime_type: photo.mime_type,
      file_name: photo.file_name,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.path || null;
}

async function processSyncEntry(entry: SyncQueueEntry): Promise<void> {
  switch (entry.action) {
    case "create_edl": {
      const payload = entry.payload as any;
      await syncDraft(payload);
      break;
    }
    case "create_item": {
      const payload = entry.payload as any;
      await syncItem(payload.item, payload.server_edl_id, payload.photo_paths || []);
      break;
    }
    case "upload_photo": {
      const payload = entry.payload as any;
      await syncPhoto(payload.photo, payload.server_edl_id);
      break;
    }
    default:
      console.warn(`[Sync] Action inconnue : ${entry.action}`);
  }
}
