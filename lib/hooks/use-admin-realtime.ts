"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { adminKeys } from "./use-admin-queries";

/**
 * Subscribes to Supabase Realtime channels for admin dashboard.
 * Automatically invalidates React Query caches when data changes.
 */
export function useAdminRealtime(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const invalidateStats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
  }, [queryClient]);

  const invalidateModeration = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: adminKeys.moderationQueue(),
    });
  }, [queryClient]);

  const invalidateAuditLogs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: adminKeys.auditLogs() });
  }, [queryClient]);

  useEffect(() => {
    if (options?.enabled === false) return;

    const supabase = createClient();

    const channel = supabase
      .channel("admin-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "profiles",
        },
        invalidateStats
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "moderation_queue",
        },
        invalidateModeration
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_log",
        },
        invalidateAuditLogs
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
        },
        invalidateStats
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    options?.enabled,
    invalidateStats,
    invalidateModeration,
    invalidateAuditLogs,
  ]);
}
