/**
 * Hook React Query pour les alertes GED (expiration, documents manquants)
 *
 * Fournit:
 * - useGedAlertsSummary: Résumé des alertes (compteurs + liste)
 * - useGedDismissAlert: Ignorer une alerte
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import { gedQueryKeys } from "./use-ged-documents";
import type { GedDocument, DocumentAlertsSummary, ExpiryStatus } from "@/lib/types/ged";

/**
 * Récupère le résumé des alertes d'expiration pour le propriétaire courant.
 *
 * Calcule les alertes côté client à partir des documents avec valid_until.
 */
export function useGedAlertsSummary() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: gedQueryKeys.alertsSummary(profile?.id),
    queryFn: async (): Promise<DocumentAlertsSummary> => {
      if (!profile) throw new Error("Non authentifié");

      const supabase = getTypedSupabaseClient(typedSupabaseClient);

      // Récupérer les propriétés du propriétaire
      const { data: ownerProperties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", profile.id);

      const propertyIds = ownerProperties?.map((p: { id: string }) => p.id) || [];

      if (propertyIds.length === 0) {
        return {
          expired_count: 0,
          expiring_soon_count: 0,
          expiring_notice_count: 0,
          alert_documents: [],
        };
      }

      // Récupérer les documents avec date d'expiration
      const { data: docs, error } = await supabase
        .from("documents")
        .select("id, type, title, valid_until, property_id, lease_id")
        .not("valid_until", "is", null)
        .eq("is_current_version", true)
        .neq("is_archived", true)
        .or(
          `owner_id.eq.${profile.id},property_id.in.(${propertyIds.join(",")})`
        )
        .order("valid_until", { ascending: true });

      if (error) throw error;

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let expiredCount = 0;
      let expiringSoonCount = 0;
      let expiringNoticeCount = 0;
      const alertDocs: DocumentAlertsSummary["alert_documents"] = [];

      for (const doc of docs || []) {
        if (!doc.valid_until) continue;
        const expDate = new Date(doc.valid_until);
        expDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil(
          (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        let status: ExpiryStatus = null;
        if (daysUntil < 0) {
          expiredCount++;
          status = "expired";
        } else if (daysUntil <= 30) {
          expiringSoonCount++;
          status = "expiring_soon";
        } else if (daysUntil <= 90) {
          expiringNoticeCount++;
          status = "expiring_notice";
        }

        if (status) {
          alertDocs.push({
            id: doc.id,
            type: doc.type,
            title: doc.title,
            valid_until: doc.valid_until,
            expiry_status: status,
            days_until_expiry: daysUntil,
            property_id: doc.property_id,
            lease_id: doc.lease_id,
          });
        }
      }

      return {
        expired_count: expiredCount,
        expiring_soon_count: expiringSoonCount,
        expiring_notice_count: expiringNoticeCount,
        alert_documents: alertDocs,
      };
    },
    enabled: !!profile && profile.role === "owner",
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Ignorer une alerte (dismiss)
 */
export function useGedDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      alertType,
    }: {
      documentId: string;
      alertType: string;
    }) => {
      const supabase = getTypedSupabaseClient(typedSupabaseClient);
      const { error } = await supabase
        .from("document_alerts")
        .update({
          status: "dismissed",
          resolved_at: new Date().toISOString(),
        })
        .eq("document_id", documentId)
        .eq("alert_type", alertType);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gedQueryKeys.all });
    },
  });
}
