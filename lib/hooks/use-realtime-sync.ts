/**
 * Synchronisation Realtime Supabase avec React Query
 *
 * Ce hook écoute les changements en temps réel sur les tables Supabase
 * et invalide automatiquement les caches React Query correspondants.
 *
 * FIX AUDIT 2026-02-16:
 * - Stabilisation des références (useRef pour callbacks, useMemo pour arrays)
 * - Ajout reconnexion automatique sur CHANNEL_ERROR / TIMED_OUT / CLOSED
 * - Suppression de `supabase` des dépendances useEffect (singleton stable)
 * - Clé de canal stable (sans Date.now()) pour éviter les re-subscriptions inutiles
 *
 * @module lib/hooks/use-realtime-sync
 */

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type PostgresChangesPayload = {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, any>;
  old: Record<string, any>;
  errors: string[] | null;
};

interface RealtimeSyncConfig {
  /** Tables à surveiller */
  tables: string[];
  /** Schéma PostgreSQL (défaut: public) */
  schema?: string;
  /** Mapping table -> queryKeys à invalider */
  queryKeyMapping?: Record<string, string[]>;
  /** Callback appelé à chaque changement */
  onUpdate?: (payload: PostgresChangesPayload) => void;
  /** Activer le mode debug */
  debug?: boolean;
}

const DEFAULT_QUERY_KEY_MAPPING: Record<string, string[]> = {
  properties: ["properties", "owner:properties", "owner-properties"],
  leases: ["leases", "owner:leases", "tenant:leases"],
  invoices: ["invoices", "owner:invoices", "tenant:invoices"],
  payments: ["payments", "owner:payments"],
  documents: ["documents", "owner:documents"],
  tenants: ["tenants", "owner:tenants"],
  profiles: ["profiles", "profile"],
  notifications: ["notifications"],
  tickets: ["tickets"],
  signatures: ["signatures", "lease-signatures"],
  edl_reports: ["edl", "edl-reports"],
  photos: ["photos", "property-photos"],
};

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 1000;

/**
 * Client Supabase singleton — résolu une seule fois au niveau module.
 * Cela garantit une référence stable entre les renders.
 */
const supabase = createClient();

/**
 * Hook pour synchroniser Supabase Realtime avec React Query
 */
export function useRealtimeSync(config: RealtimeSyncConfig) {
  const {
    tables,
    schema = "public",
    queryKeyMapping = DEFAULT_QUERY_KEY_MAPPING,
    onUpdate,
    debug = false,
  } = config;

  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("idle");

  // Stabiliser la clé de canal avec les tables triées (évite Date.now())
  const tablesKey = useMemo(() => [...tables].sort().join("-"), [tables]);

  // Stocker onUpdate et debug dans des refs pour ne pas les mettre dans les deps
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const debugRef = useRef(debug);
  debugRef.current = debug;

  /**
   * Invalide les query keys associées à une table
   */
  const invalidateQueriesForTable = useCallback(
    (table: string, payload: PostgresChangesPayload) => {
      const keys = queryKeyMapping[table] || [table];

      if (debugRef.current) {
        console.log(`[RealtimeSync] Invalidating queries for table: ${table}`, keys);
      }

      keys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });

      const entityId = payload.new?.id || payload.old?.id;
      if (entityId) {
        queryClient.invalidateQueries({ queryKey: [table, entityId] });
      }
    },
    [queryClient, queryKeyMapping]
  );

  /**
   * Crée et souscrit un canal Realtime avec gestion de reconnexion
   */
  const subscribe = useCallback(() => {
    if (tables.length === 0) return;

    // Nettoyer le canal précédent s'il existe
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `realtime-sync-${tablesKey}`;
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema, table },
        (payload: any) => {
          const typedPayload = payload as PostgresChangesPayload;

          if (debugRef.current) {
            console.log(`[RealtimeSync] ${typedPayload.eventType} on ${typedPayload.table}`, typedPayload);
          }

          invalidateQueriesForTable(typedPayload.table, typedPayload);
          onUpdateRef.current?.(typedPayload);
        }
      );
    });

    channel.subscribe((status) => {
      if (debugRef.current) {
        console.log(`[RealtimeSync] Channel status: ${status}`);
      }
      setConnectionStatus(status);

      if (status === "SUBSCRIBED") {
        reconnectAttemptRef.current = 0;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn(`[RealtimeSync] Connection lost (${status}), scheduling reconnect...`);
        scheduleReconnect();
      }
    });

    channelRef.current = channel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey, schema, invalidateQueriesForTable, tables]);

  /**
   * Planifie une reconnexion avec backoff exponentiel
   */
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[RealtimeSync] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
      setConnectionStatus("failed");
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptRef.current),
      30000
    );
    reconnectAttemptRef.current += 1;

    if (debugRef.current) {
      console.log(`[RealtimeSync] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
    }

    reconnectTimerRef.current = setTimeout(() => {
      subscribe();
    }, delay);
  }, [subscribe]);

  useEffect(() => {
    subscribe();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribe]);

  const forceInvalidate = useCallback(
    (table: string) => {
      const keys = queryKeyMapping[table] || [table];
      keys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    },
    [queryClient, queryKeyMapping]
  );

  const forceReconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    subscribe();
  }, [subscribe]);

  return {
    forceInvalidate,
    forceReconnect,
    isConnected: connectionStatus === "SUBSCRIBED",
    connectionStatus,
  };
}

/**
 * Hook pré-configuré pour les propriétaires
 */
export function useOwnerRealtimeSync(options?: { debug?: boolean }) {
  return useRealtimeSync({
    tables: ["properties", "leases", "invoices", "payments", "documents", "notifications"],
    debug: options?.debug,
  });
}

/**
 * Hook pré-configuré pour les locataires
 */
export function useTenantRealtimeSync(options?: { debug?: boolean }) {
  return useRealtimeSync({
    tables: ["leases", "invoices", "payments", "documents", "notifications", "tickets"],
    debug: options?.debug,
  });
}

/**
 * Hook pré-configuré pour les admins
 */
export function useAdminRealtimeSync(options?: { debug?: boolean }) {
  return useRealtimeSync({
    tables: [
      "properties",
      "leases",
      "profiles",
      "invoices",
      "payments",
      "documents",
      "notifications",
      "tickets",
    ],
    debug: options?.debug,
  });
}

/**
 * Hook pour écouter une table spécifique avec un filtre
 */
export function useTableRealtimeSync(
  table: string,
  options?: {
    filter?: string;
    queryKeys?: string[];
    onUpdate?: (payload: PostgresChangesPayload) => void;
    debug?: boolean;
  }
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { filter, queryKeys, onUpdate, debug = false } = options || {};

  // Stabiliser queryKeys pour éviter les re-subscriptions
  const stableQueryKeys = useMemo(() => queryKeys || [table], [queryKeys, table]);
  const queryKeysKey = stableQueryKeys.join(",");

  // Stocker les callbacks dans des refs
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const debugRef = useRef(debug);
  debugRef.current = debug;

  const subscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `realtime-${table}-${filter || "all"}`;
    const channel = supabase.channel(channelName);

    const subscriptionOptions: any = {
      event: "*",
      schema: "public",
      table,
    };

    if (filter) {
      subscriptionOptions.filter = filter;
    }

    channel.on("postgres_changes", subscriptionOptions, (payload: any) => {
      if (debugRef.current) {
        console.log(`[RealtimeSync] ${payload.eventType} on ${table}`, payload);
      }

      stableQueryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });

      const entityId = payload.new?.id || payload.old?.id;
      if (entityId) {
        queryClient.invalidateQueries({ queryKey: [table, entityId] });
      }

      onUpdateRef.current?.(payload);
    });

    channel.subscribe((status) => {
      if (debugRef.current) {
        console.log(`[RealtimeSync] Channel ${table} status: ${status}`);
      }

      if (status === "SUBSCRIBED") {
        reconnectAttemptRef.current = 0;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn(`[RealtimeSync] Channel ${table} lost (${status}), scheduling reconnect...`);
        scheduleReconnect();
      }
    });

    channelRef.current = channel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, queryKeysKey, queryClient, stableQueryKeys]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[RealtimeSync] Channel ${table}: max reconnect attempts reached.`);
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptRef.current),
      30000
    );
    reconnectAttemptRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      subscribe();
    }, delay);
  }, [subscribe, table]);

  useEffect(() => {
    subscribe();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribe]);

  return {
    isConnected: !!channelRef.current,
  };
}

export default useRealtimeSync;
