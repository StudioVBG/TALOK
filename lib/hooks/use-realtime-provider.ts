"use client";

/**
 * Hook SOTA 2026 - Dashboard temps réel PRESTATAIRE
 *
 * Écoute les changements en temps réel sur les données critiques du prestataire
 * Synchronisation avec les modifications propriétaire/locataire
 *
 * Features:
 * - Nouvelles interventions assignées
 * - Changements de statut des work orders
 * - Nouveaux avis reçus
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface ProviderRealtimeEvent {
  id: string;
  type: "work_order" | "review" | "quote";
  action: "created" | "updated" | "deleted";
  title: string;
  description: string;
  timestamp: Date;
  importance: "high" | "medium" | "low";
  data?: any;
}

interface UseRealtimeProviderOptions {
  showToasts?: boolean;
  maxEvents?: number;
  profileId?: string;
}

export function useRealtimeProvider(options: UseRealtimeProviderOptions = {}) {
  const { showToasts = true, maxEvents = 15 } = options;

  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();

  const profileId = options.profileId || profile?.id;

  const [recentEvents, setRecentEvents] = useState<ProviderRealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const channelsRef = useRef<RealtimeChannel[]>([]);

  const addEvent = useCallback(
    (event: Omit<ProviderRealtimeEvent, "id" | "timestamp">) => {
      const newEvent: ProviderRealtimeEvent = {
        ...event,
        id: crypto.randomUUID(),
        timestamp: new Date(),
      };

      setRecentEvents((prev) => [newEvent, ...prev].slice(0, maxEvents));
      setLastUpdate(new Date());

      if (showToasts && event.importance === "high") {
        toast({
          title: event.title,
          description: event.description,
          duration: 6000,
        });
      }
    },
    [maxEvents, showToasts, toast]
  );

  useEffect(() => {
    if (!profileId) return;

    // Nettoyer les anciens channels
    channelsRef.current.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];

    // 1. Écouter les nouvelles interventions et changements de statut
    const workOrdersChannel = supabase
      .channel(`provider-work-orders:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "work_orders",
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const wo = payload.new as Record<string, any>;
          if (wo.provider_id !== profileId) return;

          setNewOrdersCount((prev) => prev + 1);
          addEvent({
            type: "work_order",
            action: "created",
            title: "Nouvelle intervention",
            description: "Une intervention vous a été assignée",
            importance: "high",
            data: wo,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "work_orders",
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const wo = payload.new as Record<string, any>;
          const oldWo = payload.old as Record<string, any>;
          if (wo.provider_id !== profileId) return;

          if (oldWo.statut !== wo.statut) {
            const statusMessages: Record<string, string> = {
              accepted: "Intervention confirmée",
              scheduled: "Intervention planifiée",
              completed: "Intervention terminée",
              cancelled: "Intervention annulée",
            };

            addEvent({
              type: "work_order",
              action: "updated",
              title: statusMessages[wo.statut] || "Intervention mise à jour",
              description: `Statut : ${wo.statut}`,
              importance: wo.statut === "cancelled" ? "high" : "medium",
              data: wo,
            });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelsRef.current.push(workOrdersChannel);

    // 2. Écouter les nouveaux avis
    const reviewsChannel = supabase
      .channel(`provider-reviews:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "provider_reviews",
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const review = payload.new as Record<string, any>;
          if (review.provider_id !== profileId) return;

          addEvent({
            type: "review",
            action: "created",
            title: "Nouvel avis reçu",
            description: `Note : ${review.rating_overall}/5${review.comment ? ` - "${review.comment.substring(0, 50)}..."` : ""}`,
            importance: "medium",
            data: review,
          });
        }
      )
      .subscribe();

    channelsRef.current.push(reviewsChannel);

    return () => {
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [profileId, supabase, addEvent]);

  const clearNewOrdersCount = useCallback(() => {
    setNewOrdersCount(0);
  }, []);

  return {
    recentEvents,
    isConnected,
    lastUpdate,
    newOrdersCount,
    clearNewOrdersCount,
  };
}
