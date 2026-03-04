"use client";

/**
 * Hook SOTA 2026 - Dashboard temps réel LOCATAIRE
 * 
 * Écoute les changements en temps réel sur les données critiques du locataire
 * Synchronisation bidirectionnelle avec les modifications du propriétaire
 * 
 * Features:
 * - Modifications de loyer/charges en live
 * - Nouvelles factures générées
 * - Documents uploadés par le propriétaire
 * - Changements de statut du bail
 * - Tickets mis à jour
 * - EDLs planifiés
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface TenantRealtimeEvent {
  id: string;
  type: "lease" | "invoice" | "document" | "ticket" | "edl" | "property";
  action: "created" | "updated" | "deleted";
  title: string;
  description: string;
  timestamp: Date;
  importance: "high" | "medium" | "low";
  data?: any;
}

export interface TenantRealtimeData {
  // Données financières
  currentRent: number;
  currentCharges: number;
  totalMonthly: number;
  unpaidAmount: number;
  
  // Statuts
  leaseStatus: string;
  pendingSignatures: number;
  openTickets: number;
  
  // Événements récents
  recentEvents: TenantRealtimeEvent[];
  
  // État de connexion
  isConnected: boolean;
  lastUpdate: Date | null;
  
  // Indicateurs de changements récents (pour animations UI)
  hasRecentLeaseChange: boolean;
  hasRecentInvoice: boolean;
  hasRecentDocument: boolean;
}

interface UseTenantRealtimeOptions {
  /** Activer les toasts pour les événements importants */
  showToasts?: boolean;
  /** Jouer un son pour les notifications importantes */
  enableSound?: boolean;
  /** Maximum d'événements récents à conserver */
  maxEvents?: number;
  /** IDs des baux à écouter (optionnel, récupéré automatiquement sinon) */
  leaseIds?: string[];
  /** Callback appelé quand un document est créé/modifié (pour invalider le cache React Query) */
  onDocumentChange?: () => void;
  /** Callback appelé quand des données importantes changent (pour refetch le dashboard) */
  onDataChange?: () => void;
}

export function useTenantRealtime(options: UseTenantRealtimeOptions = {}) {
  const { showToasts = true, enableSound = false, maxEvents = 15 } = options;
  
  const { profile } = useAuth();
  const { toast } = useToast();
  
  // FIX AUDIT 2026-02-16: Stabiliser toast dans un ref pour ne pas déclencher de re-subscribe
  const toastRef = useRef(toast);
  toastRef.current = toast;
  
  const [data, setData] = useState<TenantRealtimeData>({
    currentRent: 0,
    currentCharges: 0,
    totalMonthly: 0,
    unpaidAmount: 0,
    leaseStatus: "",
    pendingSignatures: 0,
    openTickets: 0,
    recentEvents: [],
    isConnected: false,
    lastUpdate: null,
    hasRecentLeaseChange: false,
    hasRecentInvoice: false,
    hasRecentDocument: false,
  });
  
  const [loading, setLoading] = useState(true);
  const [leaseIds, setLeaseIds] = useState<string[]>(options.leaseIds || []);
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const addEventRef = useRef<typeof addEvent>(null!);
  const supabaseRef = useRef(createClient());

  // FIX AUDIT 2026-03-04: Refs for callbacks to bridge realtime → React Query/refetch
  const onDocumentChangeRef = useRef(options.onDocumentChange);
  onDocumentChangeRef.current = options.onDocumentChange;
  const onDataChangeRef = useRef(options.onDataChange);
  onDataChangeRef.current = options.onDataChange;

  // Jouer un son de notification
  const playNotificationSound = useCallback(() => {
    if (enableSound && typeof window !== "undefined") {
      try {
        const audio = new Audio("/sounds/notification.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}
    }
  }, [enableSound]);

  // Ajouter un événement avec toast optionnel
  const addEvent = useCallback((
    event: Omit<TenantRealtimeEvent, "id" | "timestamp">,
    showNotification = true
  ) => {
    const newEvent: TenantRealtimeEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    
    setData(prev => ({
      ...prev,
      recentEvents: [newEvent, ...prev.recentEvents].slice(0, maxEvents),
      lastUpdate: new Date(),
      // Marquer les changements récents pour les animations UI
      hasRecentLeaseChange: event.type === "lease" ? true : prev.hasRecentLeaseChange,
      hasRecentInvoice: event.type === "invoice" ? true : prev.hasRecentInvoice,
      hasRecentDocument: event.type === "document" ? true : prev.hasRecentDocument,
    }));
    
    // Toast et son pour les événements importants
    if (showNotification && showToasts && event.importance === "high") {
      playNotificationSound();
      toastRef.current({
        title: `🔔 ${event.title}`,
        description: event.description,
        duration: 6000,
      });
    }
    
    // Réinitialiser les indicateurs après 5 secondes
    setTimeout(() => {
      setData(prev => ({
        ...prev,
        hasRecentLeaseChange: false,
        hasRecentInvoice: false,
        hasRecentDocument: false,
      }));
    }, 5000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxEvents, showToasts, playNotificationSound]);

  // Récupérer les IDs des baux du locataire
  const fetchLeaseIds = useCallback(async () => {
    if (!profile?.id) return [];
    
    const { data: signers } = await supabaseRef.current
      .from("lease_signers")
      .select("lease_id")
      .eq("profile_id", profile.id);
    
    return signers?.map(s => s.lease_id).filter(Boolean) || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Charger les données initiales
  const fetchInitialData = useCallback(async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    
    try {
      // Récupérer les IDs des baux si non fournis
      let ids = options.leaseIds || [];
      if (ids.length === 0) {
        ids = await fetchLeaseIds();
        setLeaseIds(ids);
      }
      
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      
      // Récupérer les données en parallèle
      const [
        { data: leases },
        { data: invoices },
        { data: tickets },
        { data: signers },
      ] = await Promise.all([
        // Baux actifs avec infos financières
        supabaseRef.current
          .from("leases")
          .select("id, loyer, charges_forfaitaires, statut, type_bail, property_id")
          .in("id", ids),
        // Factures impayées
        supabaseRef.current
          .from("invoices")
          .select("id, montant_total, statut, periode")
          .in("lease_id", ids)
          .in("statut", ["sent", "late"]),
        // Tickets ouverts
        supabaseRef.current
          .from("tickets")
          .select("id, statut")
          .eq("created_by_profile_id", profile.id)
          .in("statut", ["open", "in_progress"]),
        // Signatures en attente
        supabaseRef.current
          .from("lease_signers")
          .select("id, signature_status")
          .eq("profile_id", profile.id)
          .eq("signature_status", "pending"),
      ]);
      
      // Calculer les stats
      const activeLease = leases?.find(l => l.statut === "active") || leases?.[0];
      const currentRent = activeLease?.loyer || 0;
      const currentCharges = activeLease?.charges_forfaitaires || 0;
      const unpaidAmount = invoices?.reduce((sum, inv) => sum + (inv.montant_total || 0), 0) || 0;
      
      setData(prev => ({
        ...prev,
        currentRent,
        currentCharges,
        totalMonthly: currentRent + currentCharges,
        unpaidAmount,
        leaseStatus: activeLease?.statut || "",
        pendingSignatures: signers?.length || 0,
        openTickets: tickets?.length || 0,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      console.error("[useTenantRealtime] Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, options.leaseIds, fetchLeaseIds]);

  // Charger les données au montage
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Maintenir le ref à jour
  addEventRef.current = addEvent;

  // Configurer les listeners temps réel
  useEffect(() => {
    if (!profile?.id || leaseIds.length === 0) return;

    const setupRealtime = async () => {
      // Nettoyer les anciens channels
      channelsRef.current.forEach(channel => {
        supabaseRef.current.removeChannel(channel);
      });
      channelsRef.current = [];

      // Helper: track connection status across all channels
      const channelStatuses = new Map<string, boolean>();
      const updateConnectionStatus = (name: string, status: string) => {
        channelStatuses.set(name, status === "SUBSCRIBED");
        const allConnected = channelStatuses.size > 0 &&
          Array.from(channelStatuses.values()).every(Boolean);
        setData(prev => ({ ...prev, isConnected: allConnected }));
      };

      // 1. Écouter les changements sur les BAUX (loyer, charges, statut)
      // FIX AUDIT 2026-03-04: Ajouter filtre serveur pour chaque lease
      for (const leaseId of leaseIds) {
        const leaseCh = supabaseRef.current
          .channel(`tenant-lease:${leaseId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "leases",
              filter: `id=eq.${leaseId}`,
            },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const lease = payload.new as Record<string, any>;
            const oldLease = payload.old as Record<string, any>;

            // Vérifier que c'est un de nos baux
            if (!leaseIds.includes(lease.id)) return;
            
            // Changement de loyer
            if (oldLease.loyer !== lease.loyer) {
              const diff = lease.loyer - oldLease.loyer;
              addEvent({
                type: "lease",
                action: "updated",
                title: "Loyer modifié",
                description: `Nouveau loyer: ${lease.loyer}€ (${diff > 0 ? '+' : ''}${diff}€)`,
                importance: "high",
                data: lease,
              });
              
              setData(prev => ({
                ...prev,
                currentRent: lease.loyer,
                totalMonthly: lease.loyer + prev.currentCharges,
              }));
            }
            
            // Changement de charges
            if (oldLease.charges_forfaitaires !== lease.charges_forfaitaires) {
              addEvent({
                type: "lease",
                action: "updated",
                title: "Charges modifiées",
                description: `Nouvelles charges: ${lease.charges_forfaitaires}€`,
                importance: "medium",
                data: lease,
              });
              
              setData(prev => ({
                ...prev,
                currentCharges: lease.charges_forfaitaires,
                totalMonthly: prev.currentRent + lease.charges_forfaitaires,
              }));
            }
            
            // Changement de statut
            if (oldLease.statut !== lease.statut) {
              const statusMessages: Record<string, string> = {
                active: "Votre bail est maintenant actif ! 🎉",
                terminated: "Votre bail a été résilié",
                pending_signature: "En attente de signature",
                fully_signed: "Toutes les signatures sont complètes",
              };
              
              addEvent({
                type: "lease",
                action: "updated",
                title: "Statut du bail modifié",
                description: statusMessages[lease.statut] || `Nouveau statut: ${lease.statut}`,
                importance: lease.statut === "active" ? "high" : "medium",
                data: lease,
              });
              
              setData(prev => ({
                ...prev,
                leaseStatus: lease.statut,
              }));
            }

            // FIX AUDIT 2026-03-04: Bridge realtime → dashboard refetch
            if (onDataChangeRef.current) {
              onDataChangeRef.current();
            }
          }
          )
          .subscribe((status) => {
            updateConnectionStatus(`lease:${leaseId}`, status);
          });

        channelsRef.current.push(leaseCh);
      }

      // 2. Écouter les NOUVELLES FACTURES
      // FIX AUDIT 2026-03-04: Ajouter filtre par lease_id pour chaque bail
      for (const leaseId of leaseIds) {
        const invoiceCh = supabaseRef.current
          .channel(`tenant-invoices:${leaseId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "invoices",
              filter: `lease_id=eq.${leaseId}`,
            },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const invoice = payload.new as Record<string, any>;

            // Vérifier que c'est pour un de nos baux
            if (!leaseIds.includes(invoice.lease_id)) return;
            
            addEvent({
              type: "invoice",
              action: "created",
              title: "Nouvelle facture",
              description: `Loyer ${invoice.periode}: ${invoice.montant_total}€`,
              importance: "high",
              data: invoice,
            });
            
            if (invoice.statut !== "paid") {
              setData(prev => ({
                ...prev,
                unpaidAmount: prev.unpaidAmount + (invoice.montant_total || 0),
              }));
            }

            // FIX AUDIT 2026-03-04: Bridge realtime → dashboard refetch
            if (onDataChangeRef.current) {
              onDataChangeRef.current();
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "invoices",
            filter: `lease_id=eq.${leaseId}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const invoice = payload.new as Record<string, any>;
            const oldInvoice = payload.old as Record<string, any>;

            // Facture payée
            if (oldInvoice.statut !== "paid" && invoice.statut === "paid") {
              addEvent({
                type: "invoice",
                action: "updated",
                title: "Paiement confirmé",
                description: `Votre paiement de ${invoice.montant_total}€ a été reçu`,
                importance: "high",
                data: invoice,
              });

              setData(prev => ({
                ...prev,
                unpaidAmount: Math.max(0, prev.unpaidAmount - (invoice.montant_total || 0)),
              }));
            }

            // FIX AUDIT 2026-03-04: Bridge realtime → dashboard refetch
            if (onDataChangeRef.current) {
              onDataChangeRef.current();
            }
          }
        )
        .subscribe((status) => {
          updateConnectionStatus(`invoices:${leaseId}`, status);
        });

        channelsRef.current.push(invoiceCh);
      }

      // 3. Écouter les NOUVEAUX DOCUMENTS
      // FIX AUDIT 2026-03-04: Filtre par tenant_id + invalider React Query cache
      const documentsChannel = supabaseRef.current
        .channel(`tenant-documents:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "documents",
            filter: `tenant_id=eq.${profile.id}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const doc = payload.new as Record<string, any>;

            const docTypeLabels: Record<string, string> = {
              quittance: "Quittance de loyer",
              bail: "Contrat de bail",
              EDL_entree: "État des lieux d'entrée",
              EDL_sortie: "État des lieux de sortie",
              attestation_assurance: "Attestation d'assurance",
            };

            addEvent({
              type: "document",
              action: "created",
              title: "Nouveau document",
              description: docTypeLabels[doc.type] || `Document: ${doc.type}`,
              importance: doc.type === "quittance" ? "high" : "medium",
              data: doc,
            });

            // FIX AUDIT 2026-03-04: Notify React Query to refetch documents list
            if (onDocumentChangeRef.current) {
              onDocumentChangeRef.current();
            }
          }
        )
        .subscribe((status) => {
          updateConnectionStatus("documents", status);
        });

      channelsRef.current.push(documentsChannel);

      // 4. Écouter les MISES À JOUR DE TICKETS
      // FIX AUDIT 2026-03-04: Ajouter filtre par created_by_profile_id
      const ticketsChannel = supabaseRef.current
        .channel(`tenant-tickets:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tickets",
            filter: `created_by_profile_id=eq.${profile.id}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const ticket = payload.new as Record<string, any>;
            const oldTicket = payload.old as Record<string, any>;

            // Changement de statut
            if (oldTicket.statut !== ticket.statut) {
              const statusMessages: Record<string, string> = {
                in_progress: "Votre demande est en cours de traitement",
                resolved: "Votre demande a été résolue ! ✅",
                closed: "Votre demande a été clôturée",
              };
              
              addEvent({
                type: "ticket",
                action: "updated",
                title: `Ticket ${ticket.statut === "resolved" ? "résolu" : "mis à jour"}`,
                description: statusMessages[ticket.statut] || `Nouveau statut: ${ticket.statut}`,
                importance: ticket.statut === "resolved" ? "high" : "medium",
                data: ticket,
              });
              
              if (["resolved", "closed"].includes(ticket.statut) && !["resolved", "closed"].includes(oldTicket.statut)) {
                setData(prev => ({
                  ...prev,
                  openTickets: Math.max(0, prev.openTickets - 1),
                }));
              }
            }
          }
        )
        .subscribe((status) => {
          updateConnectionStatus("tickets", status);
        });

      channelsRef.current.push(ticketsChannel);

      // 5. Écouter les SIGNATURES
      const signersChannel = supabaseRef.current
        .channel(`tenant-signers:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "lease_signers",
            filter: `profile_id=eq.${profile.id}`,
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const signer = payload.new as Record<string, any>;
            const oldSigner = payload.old as Record<string, any>;

            // Autre signataire a signé (ex: propriétaire)
            if (signer.profile_id !== profile.id && 
                oldSigner.signature_status === "pending" && 
                signer.signature_status === "signed") {
              addEvent({
                type: "lease",
                action: "updated",
                title: "Nouvelle signature",
                description: "Une autre partie a signé le bail",
                importance: "high",
                data: signer,
              });
            }
          }
        )
        .subscribe((status) => {
          updateConnectionStatus("signers", status);
        });

      channelsRef.current.push(signersChannel);

      // 6. Écouter les MODIFICATIONS DE PROPRIÉTÉ (adresse, etc.)
      const propertyChannel = supabaseRef.current
        .channel(`tenant-properties:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "properties",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const property = payload.new as Record<string, any>;
            const oldProperty = payload.old as Record<string, any>;

            // Changements importants
            if (oldProperty.adresse_complete !== property.adresse_complete ||
                oldProperty.ville !== property.ville) {
              addEvent({
                type: "property",
                action: "updated",
                title: "Adresse mise à jour",
                description: `Nouvelle adresse: ${property.adresse_complete}`,
                importance: "low",
                data: property,
              });
            }
          }
        )
        .subscribe((status) => {
          updateConnectionStatus("properties", status);
        });

      channelsRef.current.push(propertyChannel);

      // 7. Écouter les CHANGEMENTS D'EDL (états des lieux)
      // FIX AUDIT 2026-03-04: Filtre par lease, corrige edl.statut → edl.status, supprime owner_signed
      for (const leaseId of leaseIds) {
        const edlChannel = supabaseRef.current
          .channel(`tenant-edl:${leaseId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "edl",
              filter: `lease_id=eq.${leaseId}`,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              const edl = payload.new as Record<string, any>;

              addEvent({
                type: "edl",
                action: "created",
                title: "Nouvel état des lieux",
                description: `EDL ${edl.type === "entree" ? "d'entrée" : "de sortie"} planifié`,
                importance: "high",
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
              const edl = payload.new as Record<string, any>;
              const oldEdl = payload.old as Record<string, any>;

              // FIX: La colonne s'appelle "status" et non "statut"
              if (oldEdl.status !== "completed" && edl.status === "completed") {
                addEvent({
                  type: "edl",
                  action: "updated",
                  title: "EDL terminé",
                  description: "L'état des lieux est terminé, vérifiez le résultat",
                  importance: "high",
                  data: edl,
                });
              }
            }
          )
          .subscribe((status) => {
            updateConnectionStatus(`edl:${leaseId}`, status);
          });

        channelsRef.current.push(edlChannel);
      }
    };

    setupRealtime();

    // ✅ Reconnexion automatique sur perte de connexion WebSocket
    const reconnectInterval = setInterval(() => {
      const allSubscribed = channelsRef.current.every(
        (ch) => (ch as any).state === "joined" || (ch as any).state === "SUBSCRIBED"
      );
      if (!allSubscribed && channelsRef.current.length > 0) {
        console.warn("[useTenantRealtime] Channels déconnectés, reconnexion...");
        setData(prev => ({ ...prev, isConnected: false }));
        channelsRef.current.forEach(channel => {
          supabaseRef.current.removeChannel(channel);
        });
        channelsRef.current = [];
        setupRealtime();
      }
    }, 30000);

    return () => {
      clearInterval(reconnectInterval);
      channelsRef.current.forEach(channel => {
        supabaseRef.current.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  // FIX AUDIT 2026-02-16: Retirer supabase (singleton stable) et addEvent (ref-based)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, leaseIds]);

  // Effacer les indicateurs de changements récents
  const clearRecentIndicators = useCallback(() => {
    setData(prev => ({
      ...prev,
      hasRecentLeaseChange: false,
      hasRecentInvoice: false,
      hasRecentDocument: false,
    }));
  }, []);

  return {
    ...data,
    loading,
    refresh: fetchInitialData,
    clearRecentIndicators,
  };
}

export type { UseTenantRealtimeOptions };

