/**
 * Hook React Query pour les documents
 * 
 * Utilise les types Database générés depuis Supabase
 * 
 * 🔒 SÉCURITÉ: Chaque rôle ne voit QUE ses propres documents
 * - owner: documents où owner_id = profile.id
 * - tenant: documents où tenant_id = profile.id OU liés à ses baux
 * - provider: documents où provider_id = profile.id
 * - admin: tous les documents (via RLS)
 * - autres rôles: AUCUN document (sécurité par défaut)
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import type { Database } from "@/lib/supabase/database.types";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

// Rôles autorisés à voir des documents
const ALLOWED_ROLES = ["owner", "tenant", "provider", "admin"] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

type DocumentRow = {
  id: string;
  owner_id?: string | null;
  tenant_id?: string | null;
  property_id?: string | null;
  lease_id?: string | null;
  type: string;
  title?: string | null;
  storage_path: string;
  metadata?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
  properties?: {
    id: string;
    adresse_complete: string;
    ville: string;
  } | null;
  // Informations enrichies du locataire
  tenant?: {
    id: string;
    prenom: string | null;
    nom: string | null;
  } | null;
};
type DocumentInsert = Partial<DocumentRow>;
type DocumentUpdate = Partial<DocumentRow>;

/**
 * Vérifie si le rôle est autorisé à accéder aux documents
 */
function isAllowedRole(role: string | undefined): role is AllowedRole {
  return !!role && ALLOWED_ROLES.includes(role as AllowedRole);
}

/**
 * Hook pour récupérer tous les documents de l'utilisateur
 * 
 * 🔒 SÉCURITÉ: Filtrage OBLIGATOIRE par rôle
 */
export function useDocuments(filters?: {
  propertyId?: string | null;
  leaseId?: string | null;
  type?: string;
}) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["documents", profile?.id, profile?.role, filters],
    queryFn: async () => {
      if (!profile) throw new Error("Non authentifié");
      
      // 🔒 SÉCURITÉ: Vérifier que le rôle est autorisé
      if (!isAllowedRole(profile.role)) {
        console.error(`[SÉCURITÉ] Rôle non autorisé à voir les documents: ${profile.role}`);
        return []; // Retourner un tableau vide pour les rôles non reconnus
      }
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      
      // ========================================
      // LOCATAIRE: Documents liés à son profil ou ses baux
      // ========================================
      if (profile.role === "tenant") {
        // 1. Documents directement liés au profil du locataire
        const { data: directDocs, error: directError } = await supabaseClient
          .from("documents")
          .select("*, properties(id, adresse_complete, ville)")
          .eq("tenant_id", profile.id) // 🔒 Filtre obligatoire
          .order("created_at", { ascending: false });
        
        if (directError) console.error("Erreur docs directs:", directError);
        
        // 2. Récupérer les baux où le locataire est signataire
        const { data: signerData } = await supabaseClient
          .from("lease_signers")
          .select("lease_id")
          .eq("profile_id", profile.id); // 🔒 Filtre obligatoire
        
        const leaseIds = signerData?.map(s => s.lease_id).filter(Boolean) || [];
        
        // 3. Documents liés aux baux du locataire
        let leaseDocs: DocumentRow[] = [];
        if (leaseIds.length > 0) {
          const { data: leaseDocsData, error: leaseDocsError } = await supabaseClient
            .from("documents")
            .select("*, properties(id, adresse_complete, ville)")
            .in("lease_id", leaseIds) // 🔒 Filtre par ses baux uniquement
            .order("created_at", { ascending: false });
          
          if (!leaseDocsError && leaseDocsData) {
            leaseDocs = leaseDocsData as DocumentRow[];
          }
        }
        
        // Fusionner et dédupliquer
        const allDocs = [...(directDocs || []), ...leaseDocs];
        const uniqueDocs = allDocs.reduce((acc, doc) => {
          if (!acc.find(d => d.id === doc.id)) {
            acc.push(doc);
          }
          return acc;
        }, [] as DocumentRow[]);
        
        // Appliquer les filtres additionnels
        let filtered = uniqueDocs;
        
        if (filters?.propertyId) {
          filtered = filtered.filter(d => d.property_id === filters.propertyId);
        }
        if (filters?.leaseId) {
          filtered = filtered.filter(d => d.lease_id === filters.leaseId);
        }
        if (filters?.type) {
          filtered = filtered.filter(d => d.type === filters.type);
        }
        
        // Trier par date
        filtered.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });
        
        return filtered;
      }
      
      // ========================================
      // PROPRIÉTAIRE: Documents où owner_id = profile.id
      // ========================================
      if (profile.role === "owner") {
        let query = supabaseClient
          .from("documents")
          .select(`
            *,
            properties(id, adresse_complete, ville),
            tenant:profiles!tenant_id(id, prenom, nom)
          `)
          .eq("owner_id", profile.id) // 🔒 FILTRE OBLIGATOIRE
          .order("created_at", { ascending: false });
        
        // Filtres additionnels
        if (filters?.propertyId) {
          query = query.eq("property_id", filters.propertyId);
        }
        if (filters?.leaseId) {
          query = query.eq("lease_id", filters.leaseId);
        }
        if (filters?.type) {
          query = query.eq("type", filters.type);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data as DocumentRow[];
      }
      
      // ========================================
      // PRESTATAIRE: Documents liés à ses interventions
      // ========================================
      if (profile.role === "provider") {
        // Les prestataires voient les documents liés à leurs work_orders
        const { data: workOrders } = await supabaseClient
          .from("work_orders")
          .select("ticket_id")
          .eq("provider_id", profile.id); // 🔒 Filtre obligatoire
        
        if (!workOrders || workOrders.length === 0) {
          return [];
        }
        
        const ticketIds = workOrders.map(wo => wo.ticket_id);
        
        // Récupérer les property_ids des tickets
        const { data: tickets } = await supabaseClient
          .from("tickets")
          .select("property_id")
          .in("id", ticketIds);
        
        if (!tickets || tickets.length === 0) {
          return [];
        }
        
        const propertyIds = [...new Set(tickets.map(t => t.property_id).filter(Boolean))];
        
        // Documents liés aux propriétés des interventions (devis, rapports, etc.)
        let query = supabaseClient
          .from("documents")
          .select("*, properties(id, adresse_complete, ville)")
          .in("property_id", propertyIds)
          .in("type", ["devis", "ordre_mission", "rapport_intervention", "facture"]) // Types limités
          .order("created_at", { ascending: false });
        
        if (filters?.propertyId) {
          query = query.eq("property_id", filters.propertyId);
        }
        if (filters?.type) {
          query = query.eq("type", filters.type);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data as DocumentRow[];
      }
      
      // ========================================
      // ADMIN: Tous les documents (via RLS côté Supabase)
      // ========================================
      if (profile.role === "admin") {
        let query = supabaseClient
          .from("documents")
          .select(`
            *,
            properties(id, adresse_complete, ville),
            tenant:profiles!tenant_id(id, prenom, nom)
          `)
          .order("created_at", { ascending: false });
        
        // Filtres additionnels
        if (filters?.propertyId) {
          query = query.eq("property_id", filters.propertyId);
        }
        if (filters?.leaseId) {
          query = query.eq("lease_id", filters.leaseId);
        }
        if (filters?.type) {
          query = query.eq("type", filters.type);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data as DocumentRow[];
      }
      
      // 🔒 SÉCURITÉ: Par défaut, aucun document
      console.error(`[SÉCURITÉ] Rôle non géré: ${profile.role}`);
      return [];
    },
    enabled: !!profile,
  });
}

/**
 * Hook pour récupérer un document par ID
 * 
 * 🔒 SÉCURITÉ: La RLS côté Supabase filtre automatiquement
 * Seuls les documents accessibles à l'utilisateur seront retournés
 */
export function useDocument(documentId: string | null) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["document", documentId, profile?.id],
    queryFn: async () => {
      if (!documentId) throw new Error("Document ID requis");
      if (!profile) throw new Error("Non authentifié");
      
      // 🔒 Vérifier le rôle
      if (!isAllowedRole(profile.role)) {
        throw new Error("Accès non autorisé");
      }
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data, error } = await supabaseClient
        .from("documents")
        .select("*, properties(id, adresse_complete, ville)")
        .eq("id", documentId)
        .single();
      
      if (error) {
        // Si pas trouvé, c'est probablement une restriction RLS
        if (error.code === "PGRST116") {
          throw new Error("Document non trouvé ou accès refusé");
        }
        throw error;
      }
      return data as DocumentRow;
    },
    enabled: !!documentId && !!profile,
  });
}

/**
 * Hook pour créer un document
 * 
 * 🔒 SÉCURITÉ: Lie automatiquement le document au profil de l'utilisateur
 */
export function useCreateDocument() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (data: DocumentInsert) => {
      if (!profile) throw new Error("Non authentifié");
      
      // 🔒 Vérifier le rôle
      if (!isAllowedRole(profile.role)) {
        throw new Error("Rôle non autorisé à créer des documents");
      }
      
      // 🔒 Forcer l'association au profil de l'utilisateur
      const insertData: DocumentInsert = {
        ...data,
        owner_id: profile.role === "owner" ? profile.id : data.owner_id,
        tenant_id: profile.role === "tenant" ? profile.id : data.tenant_id,
      };
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: document, error } = await supabaseClient
        .from("documents")
        .insert(insertData as any)
        .select()
        .single();
      
      if (error) throw error;
      return document as DocumentRow;
    },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (document.property_id) {
        queryClient.invalidateQueries({ queryKey: ["property", document.property_id] });
      }
      if (document.lease_id) {
        queryClient.invalidateQueries({ queryKey: ["lease", document.lease_id] });
      }
    },
  });
}

/**
 * Hook pour mettre à jour un document
 * 
 * 🔒 SÉCURITÉ: La RLS empêche la modification de documents non autorisés
 */
export function useUpdateDocument() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DocumentUpdate }) => {
      if (!profile) throw new Error("Non authentifié");
      
      // 🔒 Vérifier le rôle
      if (!isAllowedRole(profile.role)) {
        throw new Error("Rôle non autorisé à modifier des documents");
      }
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: document, error } = await supabaseClient
        .from("documents")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      
      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Document non trouvé ou modification non autorisée");
        }
        throw error;
      }
      return document as DocumentRow;
    },
    onSuccess: (document, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", variables.id] });
      if (document.property_id) {
        queryClient.invalidateQueries({ queryKey: ["property", document.property_id] });
      }
      if (document.lease_id) {
        queryClient.invalidateQueries({ queryKey: ["lease", document.lease_id] });
      }
    },
  });
}

/**
 * Hook pour supprimer un document
 * 
 * 🔒 SÉCURITÉ: La RLS empêche la suppression de documents non autorisés
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (id: string) => {
      if (!profile) throw new Error("Non authentifié");
      
      // 🔒 Vérifier le rôle
      if (!isAllowedRole(profile.role)) {
        throw new Error("Rôle non autorisé à supprimer des documents");
      }
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { error } = await supabaseClient
        .from("documents")
        .delete()
        .eq("id", id);
      
      if (error) {
        if (error.code === "PGRST116" || error.message?.includes("0 rows")) {
          throw new Error("Document non trouvé ou suppression non autorisée");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

