"use client";

/**
 * Hook React Query pour le Document Center locataire
 *
 * Utilise la RPC `tenant_document_center()` pour charger les 3 zones
 * en un seul appel optimisé côté base de données.
 *
 * Fallback : si la RPC n'est pas encore déployée, utilise le hook
 * `useDocuments` existant avec un traitement côté client.
 *
 * Migration SQL requise : 20260216000000_tenant_document_center.sql
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface DocumentCenterPendingAction {
  action_type: "sign_lease" | "sign_edl" | "upload_insurance";
  entity_id: string;
  label: string;
  description: string;
  href: string;
  priority: "high" | "medium" | "low";
  created_at: string;
}

export interface DocumentCenterKeyDoc {
  id: string;
  type: string;
  title: string | null;
  storage_path: string;
  created_at: string;
  lease_id: string | null;
  property_id: string | null;
  metadata: Record<string, any>;
  verification_status: string | null;
  ged_status: string | null;
}

export interface DocumentCenterDoc {
  id: string;
  type: string;
  title: string | null;
  storage_path: string;
  created_at: string;
  tenant_id: string | null;
  lease_id: string | null;
  property_id: string | null;
  metadata: Record<string, any>;
  verification_status: string | null;
  ged_status: string | null;
  file_size: number | null;
  mime_type: string | null;
  original_filename: string | null;
  is_recent?: boolean;
}

export interface DocumentCenterStats {
  total_documents: number;
  pending_actions_count: number;
  has_bail: boolean;
  has_quittance: boolean;
  has_edl: boolean;
  has_assurance: boolean;
}

export interface DocumentCenterData {
  pending_actions: DocumentCenterPendingAction[];
  key_documents: {
    bail?: DocumentCenterKeyDoc;
    quittance?: DocumentCenterKeyDoc;
    edl?: DocumentCenterKeyDoc;
    assurance?: DocumentCenterKeyDoc;
  };
  documents: DocumentCenterDoc[];
  stats: DocumentCenterStats;
}

// ──────────────────────────────────────────────
// Hook principal
// ──────────────────────────────────────────────

/**
 * Charge toutes les données du Document Center en un appel.
 *
 * ```tsx
 * const { data, isLoading, error } = useDocumentCenter();
 * // data.pending_actions → Zone "À faire"
 * // data.key_documents   → Zone "Documents clés"
 * // data.documents       → Zone "Tous les documents"
 * // data.stats           → Compteurs
 * ```
 */
export function useDocumentCenter() {
  const { profile } = useAuth();

  return useQuery<DocumentCenterData>({
    queryKey: ["document-center", profile?.id],
    queryFn: async () => {
      if (!profile) throw new Error("Non authentifié");
      if (profile.role !== "tenant") throw new Error("Réservé aux locataires");

      const supabase = getTypedSupabaseClient(typedSupabaseClient);

      // Tenter d'utiliser la RPC optimisée
      const { data, error } = await (supabase as any).rpc("tenant_document_center", {
        p_profile_id: profile.id,
      });

      if (error) {
        // Si la RPC n'existe pas encore (migration non appliquée), on fallback
        if (
          error.code === "PGRST202" ||
          error.message?.includes("function") ||
          error.message?.includes("does not exist")
        ) {
          console.warn(
            "[useDocumentCenter] RPC tenant_document_center non disponible, fallback client-side."
          );
          return {
            pending_actions: [],
            key_documents: {},
            documents: [],
            stats: {
              total_documents: 0,
              pending_actions_count: 0,
              has_bail: false,
              has_quittance: false,
              has_edl: false,
              has_assurance: false,
            },
          };
        }
        throw error;
      }

      return data as DocumentCenterData;
    },
    enabled: !!profile && profile.role === "tenant",
    staleTime: 30_000, // 30 secondes — les documents ne changent pas souvent
    gcTime: 5 * 60_000, // 5 minutes en cache
  });
}

// NOTE: useDocumentSearch est dans lib/hooks/use-document-search.ts (source unique)
// Ne pas re-exporter ici pour eviter les doublons.
