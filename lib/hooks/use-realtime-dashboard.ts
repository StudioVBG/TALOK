"use client";

/**
 * Hook SOTA 2026 - Dashboard temps réel
 * Écoute les changements en temps réel sur les données critiques du propriétaire
 * 
 * Features:
 * - Revenus live (paiements reçus)
 * - Statuts de baux actualisés
 * - Nouveaux tickets
 * - Signatures en attente
 */

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

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
  const supabase = createClient();
  
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
      toast({
        title: "💰 " + event.title,
        description: event.description,
        duration: 5000,
      });
    }
  }, [maxEvents, showToasts, toast]);

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
      
      const propertyIds = properties?.map(p => p.id) || [];
      
      if (propertyIds.length === 0) {
        setLoading(false);
        return;
      }
      
      // Récupérer les stats en parallèle
      // Calculer la période du mois en cours au format YYYY-MM pour le filtre sur invoices
      const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      
      const [
        { data: invoices },
        { data: leases },
        { data: signers },
        { data: tickets },
      ] = await Promise.all([
        // Factures du mois en cours (utiliser owner_id et periode, pas property_id/created_at)
        supabase
          .from("invoices")
          .select("montant_total, statut")
          .eq("owner_id", ownerId)
          .eq("periode", currentPeriod),
        // Baux actifs
        supabase
          .from("leases")
          .select("id, statut")
          .in("property_id", propertyIds),
        // Signatures en attente
        supabase
          .from("lease_signers")
          .select("id, signature_status, lease:leases!inner(property_id)")
          .eq("signature_status", "pending"),
        // Tickets ouverts
        supabase
          .from("tickets")
          .select("id, statut")
          .in("property_id", propertyIds)
          .in("statut", ["open", "in_progress"]),
      ]);
      
      // Calculer les stats
      const paidInvoices = invoices?.filter(i => i.statut === "paid") || [];
      const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.montant_total || 0), 0);
      const pendingPayments = invoices?.filter(i => i.statut === "sent" || i.statut === "draft").length || 0;
      const latePayments = invoices?.filter(i => i.statut === "late").length || 0;
      const activeLeases = leases?.filter(l => l.statut === "active").length || 0;
      
      // Filtrer les signataires pour les propriétés du propriétaire
      const pendingSignatures = signers?.filter(s => 
        propertyIds.includes((s.lease as any)?.property_id)
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
  }, [ownerId, supabase]);

  // Charger les données au montage
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Configurer les listeners temps réel
  useEffect(() => {
    if (!ownerId) return;

    const channels: RealtimeChannel[] = [];

    const setupRealtime = async () => {
      // 1. Écouter les paiements
      const paymentsChannel = supabase
        .channel(`payments:${ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "payments",
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

      // 2. Écouter les changements de statut des factures
      const invoicesChannel = supabase
        .channel(`invoices:${ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "invoices",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const invoice = payload.new;
            const oldInvoice = payload.old;
            
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

      // 3. Écouter les signatures de bail
      const signersChannel = supabase
        .channel(`signers:${ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "lease_signers",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const signer = payload.new;
            const oldSigner = payload.old;
            
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
      
      channels.push(signersChannel);

      // 4. Écouter les tickets
      const ticketsChannel = supabase
        .channel(`tickets:${ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tickets",
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
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const ticket = payload.new;
            const oldTicket = payload.old;
            
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
      
      channels.push(ticketsChannel);

      // 5. Écouter les changements de statut de bail
      const leasesChannel = supabase
        .channel(`leases:${ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "leases",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const lease = payload.new;
            const oldLease = payload.old;
            
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
      
      channels.push(leasesChannel);
    };

    setupRealtime();

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [ownerId, supabase, addEvent]);

  return {
    ...data,
    loading,
    refresh: fetchInitialData,
  };
}

export type { UseRealtimeDashboardOptions };

