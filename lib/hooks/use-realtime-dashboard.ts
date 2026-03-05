"use client";

/**
 * Hook SOTA 2026 - Dashboard temps réel (propriétaire)
 * Écoute les changements en temps réel sur les données critiques du propriétaire
 *
 * FIX AUDIT 2026-03-05: Ajout de filtres serveur sur TOUS les channels
 * Avant: 8 channels sans filtre → fuite de données cross-owner
 * Après: filtres par owner_id, property_id, lease_id selon la table
 *
 * Features:
 * - Revenus live (paiements reçus)
 * - Statuts de baux actualisés
 * - Nouveaux tickets
 * - Signatures en attente
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const supabase = createClient();

export interface RealtimeDashboardData {
  // Compteurs live
  totalRevenue: number;
  pendingPayments: number;
  latePayments: number;
  activeLeases: number;
  pendingSignatures: number;
  openTickets: number;

  // Événements récents
  recentEvents: RealtimeEvent[];

  // État de connexion
  isConnected: boolean;
  lastUpdate: Date | null;
}

export interface RealtimeEvent {
  id: string;
  type: "payment" | "lease" | "ticket" | "signature" | "edl";
  action: "created" | "updated" | "deleted";
  title: string;
  description: string;
  timestamp: Date;
  data?: any;
}

interface UseRealtimeDashboardOptions {
  /** Activer les toasts pour les événements importants */
  showToasts?: boolean;
  /** Maximum d'événements récents à conserver */
  maxEvents?: number;
  /** Profil ID du propriétaire (optionnel, utilise useAuth sinon) */
  ownerId?: string;
}

export function useRealtimeDashboard(options: UseRealtimeDashboardOptions = {}) {
  const { showToasts = true, maxEvents = 10 } = options;

  const { profile } = useAuth();
  const { toast } = useToast();

  // FIX AUDIT 2026-02-16: Stabiliser toast dans un ref
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const ownerId = options.ownerId || profile?.id;

  const [data, setData] = useState<RealtimeDashboardData>({
    totalRevenue: 0,
    pendingPayments: 0,
    latePayments: 0,
    activeLeases: 0,
    pendingSignatures: 0,
    openTickets: 0,
    recentEvents: [],
    isConnected: false,
    lastUpdate: null,
  });

  const [loading, setLoading] = useState(true);
  // FIX AUDIT 2026-03-05: Stocker les IDs pour les filtres realtime
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [leaseIds, setLeaseIds] = useState<string[]>([]);

  // Ajouter un événement récent
  const addEvent = useCallback((event: Omit<RealtimeEvent, "id" | "timestamp">) => {
    const newEvent: RealtimeEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    setData(prev => ({
      ...prev,
      recentEvents: [newEvent, ...prev.recentEvents].slice(0, maxEvents),
      lastUpdate: new Date(),
    }));

    if (showToasts && event.type === "payment" && event.action === "created") {
      toastRef.current({
        title: "💰 " + event.title,
        description: event.description,
        duration: 5000,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxEvents, showToasts]);

  // Charger les données initiales
  const fetchInitialData = useCallback(async () => {
    if (!ownerId) return;

    setLoading(true);

    try {
      // Récupérer les propriétés du propriétaire
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", ownerId);

      const propIds = properties?.map(p => p.id) || [];
      setPropertyIds(propIds);

      if (propIds.length === 0) {
        setLoading(false);
        return;
      }

      // Récupérer les stats en parallèle
      const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      const [
        { data: invoices },
        { data: leases },
        { data: signers },
        { data: tickets },
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("montant_total, statut")
          .eq("owner_id", ownerId)
          .eq("periode", currentPeriod),
        supabase
          .from("leases")
          .select("id, statut")
          .in("property_id", propIds),
        supabase
          .from("lease_signers")
          .select("id, signature_status, lease:leases!inner(property_id)")
          .eq("signature_status", "pending"),
        supabase
          .from("tickets")
          .select("id, statut")
          .in("property_id", propIds)
          .in("statut", ["open", "in_progress"]),
      ]);

      // Stocker les lease IDs pour les filtres realtime
      const lIds = leases?.map(l => l.id) || [];
      setLeaseIds(lIds);

      // Calculer les stats
      const paidInvoices = invoices?.filter(i => i.statut === "paid") || [];
      const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.montant_total || 0), 0);
      const pendingPayments = invoices?.filter(i => i.statut === "sent" || i.statut === "draft").length || 0;
      const latePayments = invoices?.filter(i => i.statut === "late").length || 0;
      const activeLeases = leases?.filter(l => l.statut === "active").length || 0;

      // Filtrer les signataires pour les propriétés du propriétaire
      const pendingSignatures = signers?.filter(s =>
        propIds.includes((s.lease as any)?.property_id)
      ).length || 0;

      const openTickets = tickets?.length || 0;

      setData(prev => ({
        ...prev,
        totalRevenue,
        pendingPayments,
        latePayments,
        activeLeases,
        pendingSignatures,
        openTickets,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      console.error("[useRealtimeDashboard] Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  // Charger les données au montage
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Configurer les listeners temps réel
  // FIX AUDIT 2026-03-05: Tous les channels ont maintenant des filtres serveur
  useEffect(() => {
    if (!ownerId || propertyIds.length === 0) return;

    const channels: RealtimeChannel[] = [];

    const setupRealtime = () => {
      // 1. Écouter les paiements (filtre par owner_id)
      const paymentsChannel = supabase
        .channel(`owner-payments:${ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "payments",
            filter: `owner_id=eq.${ownerId}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const payment = payload.new;
            if (payment.statut === "succeeded") {
              setData(prev => ({
                ...prev,
                totalRevenue: prev.totalRevenue + (payment.montant || 0),
                lastUpdate: new Date(),
              }));

              addEvent({
                type: "payment",
                action: "created",
                title: "Paiement reçu",
                description: `${payment.montant}€ reçus`,
                data: payment,
              });
            }
          }
        )
        .subscribe((status) => {
          setData(prev => ({ ...prev, isConnected: status === "SUBSCRIBED" }));
        });

      channels.push(paymentsChannel);

      // 2. Écouter les changements de statut des factures (filtre par owner_id)
      const invoicesChannel = supabase
        .channel(`owner-invoices:${ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "invoices",
            filter: `owner_id=eq.${ownerId}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const invoice = payload.new;
            const oldInvoice = payload.old as Record<string, any>;

            if (oldInvoice.statut !== invoice.statut) {
              if (invoice.statut === "paid") {
                setData(prev => ({
                  ...prev,
                  pendingPayments: Math.max(0, prev.pendingPayments - 1),
                  lastUpdate: new Date(),
                }));

                addEvent({
                  type: "payment",
                  action: "updated",
                  title: "Facture payée",
                  description: `Facture ${invoice.periode} réglée`,
                  data: invoice,
                });
              } else if (invoice.statut === "late") {
                setData(prev => ({
                  ...prev,
                  latePayments: prev.latePayments + 1,
                  lastUpdate: new Date(),
                }));

                addEvent({
                  type: "payment",
                  action: "updated",
                  title: "Retard de paiement",
                  description: `Facture ${invoice.periode} en retard`,
                  data: invoice,
                });
              }
            }
          }
        )
        .subscribe();

      channels.push(invoicesChannel);

      // 3. Écouter les signatures de bail (filtre par lease_id)
      for (const leaseId of leaseIds) {
        const signersCh = supabase
          .channel(`owner-signers:${leaseId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "lease_signers",
              filter: `lease_id=eq.${leaseId}`,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              const signer = payload.new;
              const oldSigner = payload.old as Record<string, any>;

              if (oldSigner.signature_status === "pending" && signer.signature_status === "signed") {
                setData(prev => ({
                  ...prev,
                  pendingSignatures: Math.max(0, prev.pendingSignatures - 1),
                  lastUpdate: new Date(),
                }));

                addEvent({
                  type: "signature",
                  action: "updated",
                  title: "Nouvelle signature",
                  description: "Un signataire a signé le bail",
                  data: signer,
                });
              }
            }
          )
          .subscribe();

        channels.push(signersCh);
      }

      // 4. Écouter les tickets (filtre par property_id)
      for (const propId of propertyIds) {
        const ticketsCh = supabase
          .channel(`owner-tickets:${propId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "tickets",
              filter: `property_id=eq.${propId}`,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              const ticket = payload.new;

              setData(prev => ({
                ...prev,
                openTickets: prev.openTickets + 1,
                lastUpdate: new Date(),
              }));

              addEvent({
                type: "ticket",
                action: "created",
                title: "Nouveau ticket",
                description: ticket.titre || "Demande de maintenance",
                data: ticket,
              });
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "tickets",
              filter: `property_id=eq.${propId}`,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              const ticket = payload.new;
              const oldTicket = payload.old as Record<string, any>;

              if (["resolved", "closed"].includes(ticket.statut) && !["resolved", "closed"].includes(oldTicket.statut)) {
                setData(prev => ({
                  ...prev,
                  openTickets: Math.max(0, prev.openTickets - 1),
                  lastUpdate: new Date(),
                }));

                addEvent({
                  type: "ticket",
                  action: "updated",
                  title: "Ticket résolu",
                  description: ticket.titre || "Demande traitée",
                  data: ticket,
                });
              }
            }
          )
          .subscribe();

        channels.push(ticketsCh);
      }

      // 5. Écouter les changements de statut de bail (filtre par property_id)
      for (const propId of propertyIds) {
        const leasesCh = supabase
          .channel(`owner-leases:${propId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "leases",
              filter: `property_id=eq.${propId}`,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              const lease = payload.new;
              const oldLease = payload.old as Record<string, any>;

              if (oldLease.statut !== lease.statut) {
                if (lease.statut === "active" && oldLease.statut !== "active") {
                  setData(prev => ({
                    ...prev,
                    activeLeases: prev.activeLeases + 1,
                    lastUpdate: new Date(),
                  }));

                  addEvent({
                    type: "lease",
                    action: "updated",
                    title: "Bail activé",
                    description: "Un nouveau bail est maintenant actif",
                    data: lease,
                  });
                } else if (lease.statut === "terminated" && oldLease.statut === "active") {
                  setData(prev => ({
                    ...prev,
                    activeLeases: Math.max(0, prev.activeLeases - 1),
                    lastUpdate: new Date(),
                  }));
                }
              }
            }
          )
          .subscribe();

        channels.push(leasesCh);
      }

      // 6. Écouter les changements d'EDL (filtre par lease_id)
      for (const leaseId of leaseIds) {
        const edlCh = supabase
          .channel(`owner-edl:${leaseId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "edl",
              filter: `lease_id=eq.${leaseId}`,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              const edl = payload.new;
              addEvent({
                type: "edl",
                action: "created",
                title: "Nouvel état des lieux",
                description: `EDL ${edl.type === "entree" ? "d'entrée" : "de sortie"} créé`,
                data: edl,
              });
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "edl",
              filter: `lease_id=eq.${leaseId}`,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              const edl = payload.new;
              const oldEdl = payload.old as Record<string, any>;

              if (oldEdl.statut !== "completed" && edl.statut === "completed" && !edl.owner_signed) {
                addEvent({
                  type: "edl",
                  action: "updated",
                  title: "EDL à signer",
                  description: "Un état des lieux est terminé et attend votre signature",
                  data: edl,
                });
              }
              if (!oldEdl.owner_signed && edl.owner_signed) {
                addEvent({
                  type: "edl",
                  action: "updated",
                  title: "EDL signé",
                  description: "L'état des lieux a été signé avec succès",
                  data: edl,
                });
              }
            }
          )
          .subscribe();

        channels.push(edlCh);
      }

      // 7. Écouter les nouveaux documents (filtre par owner_id)
      const documentsChannel = supabase
        .channel(`owner-documents:${ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "documents",
            filter: `owner_id=eq.${ownerId}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const doc = payload.new;
            const docTypeLabels: Record<string, string> = {
              attestation_assurance: "Attestation d'assurance",
              quittance: "Quittance",
              bail: "Contrat de bail",
              EDL_entree: "EDL d'entrée",
              EDL_sortie: "EDL de sortie",
            };
            addEvent({
              type: "signature",
              action: "created",
              title: "Nouveau document",
              description: docTypeLabels[doc.type] || `Document: ${doc.type || "ajouté"}`,
              data: doc,
            });
          }
        )
        .subscribe();

      channels.push(documentsChannel);

      // 8. Écouter les interventions prestataire (filtre par property_id)
      for (const propId of propertyIds) {
        const workOrdersCh = supabase
          .channel(`owner-work-orders:${propId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "work_orders",
              filter: `property_id=eq.${propId}`,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              const wo = payload.new;
              addEvent({
                type: "ticket",
                action: "created",
                title: "Nouvelle intervention",
                description: `Intervention planifiée${wo.date_intervention_prevue ? ` le ${new Date(wo.date_intervention_prevue).toLocaleDateString("fr-FR")}` : ""}`,
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
              filter: `property_id=eq.${propId}`,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              const wo = payload.new;
              const oldWo = payload.old as Record<string, any>;

              if (oldWo.statut !== wo.statut) {
                const statusLabels: Record<string, string> = {
                  done: "Intervention terminée",
                  scheduled: "Intervention planifiée",
                  cancelled: "Intervention annulée",
                };
                addEvent({
                  type: "ticket",
                  action: "updated",
                  title: statusLabels[wo.statut] || "Intervention mise à jour",
                  description: wo.cout_final
                    ? `Coût final : ${wo.cout_final}€`
                    : `Statut : ${wo.statut}`,
                  data: wo,
                });
              }
            }
          )
          .subscribe();

        channels.push(workOrdersCh);
      }
    };

    setupRealtime();

    // Reconnexion automatique sur perte de connexion
    const reconnectInterval = setInterval(() => {
      const allSubscribed = channels.every(
        (ch) => (ch as any).state === "joined" || (ch as any).state === "SUBSCRIBED"
      );
      if (!allSubscribed && ownerId) {
        console.warn("[useRealtimeDashboard] Channels déconnectés, reconnexion...");
        setData(prev => ({ ...prev, isConnected: false }));
        channels.forEach(channel => {
          supabase.removeChannel(channel);
        });
        channels.length = 0;
        setupRealtime();
      }
    }, 30000);

    return () => {
      clearInterval(reconnectInterval);
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, propertyIds, leaseIds]);

  return {
    ...data,
    loading,
    refresh: fetchInitialData,
  };
}

export type { UseRealtimeDashboardOptions };
