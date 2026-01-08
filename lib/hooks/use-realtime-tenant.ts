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
}

export function useTenantRealtime(options: UseTenantRealtimeOptions = {}) {
  const { showToasts = true, enableSound = false, maxEvents = 15 } = options;
  
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  
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
      toast({
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
  }, [maxEvents, showToasts, playNotificationSound, toast]);

  // Récupérer les IDs des baux du locataire
  const fetchLeaseIds = useCallback(async () => {
    if (!profile?.id) return [];
    
    const { data: signers } = await supabase
      .from("lease_signers")
      .select("lease_id")
      .eq("profile_id", profile.id);
    
    return signers?.map(s => s.lease_id).filter(Boolean) || [];
  }, [profile?.id, supabase]);

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
        supabase
          .from("leases")
          .select("id, loyer, charges_forfaitaires, statut, type_bail, property_id")
          .in("id", ids),
        // Factures impayées
        supabase
          .from("invoices")
          .select("id, montant_total, statut, periode")
          .in("lease_id", ids)
          .in("statut", ["sent", "late"]),
        // Tickets ouverts
        supabase
          .from("tickets")
          .select("id, statut")
          .eq("created_by_profile_id", profile.id)
          .in("statut", ["open", "in_progress"]),
        // Signatures en attente
        supabase
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
  }, [profile?.id, options.leaseIds, fetchLeaseIds, supabase]);

  // Charger les données au montage
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Configurer les listeners temps réel
  useEffect(() => {
    if (!profile?.id || leaseIds.length === 0) return;

    const setupRealtime = async () => {
      // Nettoyer les anciens channels
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];

      // 1. Écouter les changements sur les BAUX (loyer, charges, statut)
      const leasesChannel = supabase
        .channel(`tenant-leases:${profile.id}`)
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
      const invoicesChannel = supabase
        .channel(`tenant-invoices:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "invoices",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const invoice = payload.new;
            
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
            const invoice = payload.new;
            const oldInvoice = payload.old;
            
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
      const documentsChannel = supabase
        .channel(`tenant-documents:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "documents",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const doc = payload.new;
            
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
      const ticketsChannel = supabase
        .channel(`tenant-tickets:${profile.id}`)
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
      const signersChannel = supabase
        .channel(`tenant-signers:${profile.id}`)
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
      const propertyChannel = supabase
        .channel(`tenant-properties:${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "properties",
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const property = payload.new;
            const oldProperty = payload.old;
            
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
    };

    setupRealtime();

    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [profile?.id, leaseIds, supabase, addEvent]);

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

