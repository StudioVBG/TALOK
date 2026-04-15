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

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  computeUnpaidStats,
  UNPAID_INVOICE_STATUSES,
} from "@/lib/payments/unpaid-invoices";

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

    const { data: signers, error } = await supabaseRef.current
      .from("lease_signers")
      .select("lease_id")
      .eq("profile_id", profile.id);

    if (error) {
      console.warn("[useTenantRealtime] fetchLeaseIds error:", error.message);
      return [];
    }

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

      // Filet défensif : on n'envoie jamais un `in("lease_id", [])` côté
      // PostgREST — ça génère une URL `lease_id=in.()` qui remonte en 500
      // dans certaines configurations. Dans tous les autres cas on ignore
      // silencieusement les ids invalides (non-UUID).
      const validIds = ids.filter(
        (id): id is string =>
          typeof id === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );

      // Récupérer les données en parallèle — `allSettled` pour qu'une
      // politique RLS cassée sur UNE table ne fasse pas tomber les trois
      // autres. Chaque query est logguée individuellement si elle échoue,
      // ce qui évite le "500 en cascade" côté UI locataire.
      const [leasesRes, invoicesRes, ticketsRes, signersRes] = await Promise.allSettled([
        validIds.length > 0
          ? supabaseRef.current
              .from("leases")
              .select("id, loyer, charges_forfaitaires, statut, type_bail, property_id")
              .in("id", validIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        validIds.length > 0
          ? supabaseRef.current
              .from("invoices")
              .select("id, montant_total, statut, periode, due_date, date_echeance, created_at, type")
              .in("lease_id", validIds)
              .in("statut", UNPAID_INVOICE_STATUSES as unknown as string[])
          : Promise.resolve({ data: [] as any[], error: null }),
        supabaseRef.current
          .from("tickets")
          .select("id, statut")
          .eq("created_by_profile_id", profile.id)
          .in("statut", ["open", "in_progress"]),
        supabaseRef.current
          .from("lease_signers")
          .select("id, signature_status")
          .eq("profile_id", profile.id)
          .eq("signature_status", "pending"),
      ]);

      const extract = <T,>(
        result: PromiseSettledResult<{ data: T[] | null; error: { message: string } | null }>,
        label: string
      ): T[] => {
        if (result.status === "rejected") {
          console.warn(`[useTenantRealtime] ${label} rejected:`, result.reason);
          return [];
        }
        if (result.value?.error) {
          console.warn(`[useTenantRealtime] ${label} error:`, result.value.error.message);
          return [];
        }
        return (result.value?.data ?? []) as T[];
      };

      const leases = extract<{ id: string; loyer: number; charges_forfaitaires: number; statut: string; type_bail: string; property_id: string }>(leasesRes, "leases");
      const invoices = extract<any>(invoicesRes, "invoices");
      const tickets = extract<{ id: string; statut: string }>(ticketsRes, "tickets");
      const signers = extract<{ id: string; signature_status: string }>(signersRes, "lease_signers");

      // Calculer les stats
      const activeLease = leases.find(l => l.statut === "active") || leases[0];
      const currentRent = activeLease?.loyer || 0;
      const currentCharges = activeLease?.charges_forfaitaires || 0;
      // Source unique : helper centralisé qui filtre uniquement les factures
      // dont la date d'échéance est passée (cohérent avec /tenant/payments).
      const unpaidAmount = computeUnpaidStats(invoices).totalAmount;
      
      setData(prev => ({
        ...prev,
        currentRent,
        currentCharges,
        totalMonthly: currentRent + currentCharges,
        unpaidAmount,
        leaseStatus: activeLease?.statut || "",
        pendingSignatures: signers.length,
        openTickets: tickets.length,
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

      // 1. Écouter les changements sur les BAUX (loyer, charges, statut)
      const leasesChannel = supabaseRef.current
        .channel(`tenant-leases:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "leases",
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
          }
        )
        .subscribe((status) => {
          setData(prev => ({ ...prev, isConnected: status === "SUBSCRIBED" }));
        });
      
      channelsRef.current.push(leasesChannel);

      // 2. Écouter les NOUVELLES FACTURES
      const invoicesChannel = supabaseRef.current
        .channel(`tenant-invoices:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "invoices",
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
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "invoices",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const invoice = payload.new as Record<string, any>;
            const oldInvoice = payload.old as Record<string, any>;

            if (!leaseIds.includes(invoice.lease_id)) return;
            
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
          }
        )
        .subscribe();
      
      channelsRef.current.push(invoicesChannel);

      // 3. Écouter les NOUVEAUX DOCUMENTS
      const documentsChannel = supabaseRef.current
        .channel(`tenant-documents:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "documents",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const doc = payload.new as Record<string, any>;

            // Vérifier que c'est pour nous ou un de nos baux
            if (doc.tenant_id !== profile.id && !leaseIds.includes(doc.lease_id)) return;
            
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
          }
        )
        .subscribe();
      
      channelsRef.current.push(documentsChannel);

      // 4. Écouter les MISES À JOUR DE TICKETS
      const ticketsChannel = supabaseRef.current
        .channel(`tenant-tickets:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tickets",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const ticket = payload.new as Record<string, any>;
            const oldTicket = payload.old as Record<string, any>;

            // Seulement les tickets créés par ce locataire
            if (ticket.created_by_profile_id !== profile.id) return;
            
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
        .subscribe();
      
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
        .subscribe();
      
      channelsRef.current.push(signersChannel);

      // 6. Écouter les MODIFICATIONS DE PROPRIÉTÉ (adresse, etc.)
      // On écoute toutes les propriétés liées aux baux
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
        .subscribe();
      
      channelsRef.current.push(propertyChannel);

      // 7. Écouter les CHANGEMENTS D'EDL (états des lieux)
      const edlChannel = supabaseRef.current
        .channel(`tenant-edl:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "edl",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const edl = payload.new as Record<string, any>;
            // Vérifier que c'est pour un de nos baux
            if (!leaseIds.includes(edl.lease_id)) return;

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
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const edl = payload.new as Record<string, any>;
            const oldEdl = payload.old as Record<string, any>;
            if (!leaseIds.includes(edl.lease_id)) return;

            // EDL complété
            if (oldEdl.statut !== "completed" && edl.statut === "completed") {
              addEvent({
                type: "edl",
                action: "updated",
                title: "EDL terminé",
                description: "L'état des lieux est terminé, vérifiez le résultat",
                importance: "high",
                data: edl,
              });
            }
            // EDL signé par le propriétaire
            if (!oldEdl.owner_signed && edl.owner_signed) {
              addEvent({
                type: "edl",
                action: "updated",
                title: "EDL validé",
                description: "Le propriétaire a signé l'état des lieux",
                importance: "high",
                data: edl,
              });
            }
          }
        )
        .subscribe();

      channelsRef.current.push(edlChannel);
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

