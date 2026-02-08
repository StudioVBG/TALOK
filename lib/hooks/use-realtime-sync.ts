/**
 * Synchronisation Realtime Supabase avec React Query
 *
 * Ce hook écoute les changements en temps réel sur les tables Supabase
 * et invalide automatiquement les caches React Query correspondants.
 *
 * @module lib/hooks/use-realtime-sync
 */

import { useEffect, useRef, useCallback } from "react";
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

// Mapping par défaut des tables vers les query keys
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
  const supabase = createClient();

  /**
   * Invalide les query keys associées à une table
   */
  const invalidateQueriesForTable = useCallback(
    (table: string, payload: PostgresChangesPayload) => {
      const queryKeys = queryKeyMapping[table] || [table];

      if (debug) {
        console.log(`[RealtimeSync] Invalidating queries for table: ${table}`, queryKeys);
      }

      // Invalider chaque query key
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });

      // Si le payload contient des IDs spécifiques, invalider aussi ces queries
      const entityId = payload.new?.id || payload.old?.id;
      if (entityId) {
        queryClient.invalidateQueries({ queryKey: [table, entityId] });
      }
    },
    [queryClient, queryKeyMapping, debug]
  );

  /**
   * Handler pour les changements Postgres
   */
  const handleChange = useCallback(
    (payload: any) => {
      const typedPayload = payload as PostgresChangesPayload;
      const table = typedPayload.table;

      if (debug) {
        console.log(`[RealtimeSync] ${typedPayload.eventType} on ${table}`, typedPayload);
      }

      // Invalider les queries
      invalidateQueriesForTable(table, typedPayload);

      // Appeler le callback custom
      onUpdate?.(typedPayload);
    },
    [invalidateQueriesForTable, onUpdate, debug]
  );

  useEffect(() => {
    if (tables.length === 0) return;

    // Créer un canal unique pour toutes les tables
    const channelName = `realtime-sync-${tables.join("-")}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // S'abonner aux changements de chaque table
    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema,
          table,
        },
        handleChange
      );
    });

    // Démarrer l'écoute
    channel.subscribe((status) => {
      if (debug) {
        console.log(`[RealtimeSync] Channel status: ${status}`);
      }
    });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tables, schema, handleChange, debug, supabase]);

  /**
   * Forcer l'invalidation d'une table
   */
  const forceInvalidate = useCallback(
    (table: string) => {
      const queryKeys = queryKeyMapping[table] || [table];
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    },
    [queryClient, queryKeyMapping]
  );

  return {
    forceInvalidate,
    isConnected: !!channelRef.current,
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
  const supabase = createClient();

  const { filter, queryKeys = [table], onUpdate, debug = false } = options || {};

  useEffect(() => {
    const channelName = `realtime-${table}-${filter || "all"}-${Date.now()}`;
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
      if (debug) {
        console.log(`[RealtimeSync] ${payload.eventType} on ${table}`, payload);
      }

      // Invalider les queries
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });

      // Invalider la query spécifique si ID présent
      const entityId = payload.new?.id || payload.old?.id;
      if (entityId) {
        queryClient.invalidateQueries({ queryKey: [table, entityId] });
      }

      onUpdate?.(payload);
    });

    channel.subscribe((status) => {
      if (debug) {
        console.log(`[RealtimeSync] Channel ${table} status: ${status}`);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter, queryKeys, onUpdate, debug, queryClient, supabase]);

  return {
    isConnected: !!channelRef.current,
  };
}

export default useRealtimeSync;
