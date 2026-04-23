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
  uploaded_by?: string | null;
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

/** Select clause with property join (explicit FK syntax for PostgREST) */
const SELECT_WITH_PROPERTY = "*, properties:property_id(id, adresse_complete, ville)";

/** Select clause with property + tenant join */
const SELECT_WITH_PROPERTY_AND_TENANT = `
  *,
  properties:property_id(id, adresse_complete, ville),
  tenant:profiles!tenant_id(id, prenom, nom)
`;

/**
 * Tente une requête avec jointures, puis fallback sans jointures si 400
 * (PostgREST renvoie 400 si les FK ne sont pas exposées)
 */
async function queryDocumentsWithFallback(
  supabaseClient: any,
  selectClause: string,
  buildQuery: (query: any) => any
): Promise<DocumentRow[]> {
  // Tentative 1 : requête avec jointures
  const fullQuery = buildQuery(
    supabaseClient.from("documents").select(selectClause)
  );
  const { data, error } = await fullQuery;

  if (!error && data) {
    return data as DocumentRow[];
  }

  // Si erreur 400 (relation introuvable), fallback sans jointures
  if (error && (error.code === "PGRST200" || error.message?.includes("relationship") || error.code?.startsWith("4"))) {
    console.warn("[useDocuments] Join query failed, falling back to simple select:", error.message);
    const fallbackQuery = buildQuery(
      supabaseClient.from("documents").select("*")
    );
    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) {
      console.error("[useDocuments] Fallback query also failed:", fallbackError);
      throw fallbackError;
    }
    return (fallbackData || []) as DocumentRow[];
  }

  if (error) throw error;
  return [];
}

/**
 * Hook pour récupérer tous les documents de l'utilisateur
 * 
 * 🔒 SÉCURITÉ: Filtrage OBLIGATOIRE par rôle
 * 📁 Par défaut, les documents archivés sont exclus
 */
export function useDocuments(filters?: {
  propertyId?: string | null;
  leaseId?: string | null;
  type?: string;
  includeArchived?: boolean; // Par défaut: false (exclure les archivés)
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
      // LOCATAIRE: Vue unifiée v_tenant_accessible_documents (SOTA 2026)
      // Fallback sur requêtes manuelles si la vue n'existe pas
      // ========================================
      if (profile.role === "tenant") {
        let allDocs: DocumentRow[] = [];
        let usedView = false;

        try {
          const { data: viewData, error: viewError } = await supabaseClient
            .from("v_tenant_accessible_documents" as any)
            .select(SELECT_WITH_PROPERTY)
            .order("created_at", { ascending: false });

          if (!viewError && viewData) {
            allDocs = viewData as DocumentRow[];
            usedView = true;
          } else if (viewError) {
            console.warn("[useDocuments] v_tenant_accessible_documents failed, falling back:", viewError);
          }
        } catch (e) {
          console.warn("[useDocuments] v_tenant_accessible_documents threw, falling back:", e);
        }

        if (!usedView) {
          const directDocs = await queryDocumentsWithFallback(
            supabaseClient,
            SELECT_WITH_PROPERTY,
            (q: any) => q.eq("tenant_id", profile.id).order("created_at", { ascending: false })
          );

          const { data: signerData } = await supabaseClient
            .from("lease_signers")
            .select("lease_id")
            .eq("profile_id", profile.id);

          const leaseIds = signerData?.map((s: any) => s.lease_id).filter(Boolean) || [];

          let leaseDocs: DocumentRow[] = [];
          if (leaseIds.length > 0) {
            leaseDocs = await queryDocumentsWithFallback(
              supabaseClient,
              SELECT_WITH_PROPERTY,
              (q: any) => q.in("lease_id", leaseIds).order("created_at", { ascending: false })
            );
          }

          let propertyDocs: DocumentRow[] = [];
          if (leaseIds.length > 0) {
            const { data: leaseData } = await supabaseClient
              .from("leases")
              .select("property_id")
              .in("id", leaseIds);

            const propertyIds = [...new Set(
              (leaseData || []).map((l: any) => l.property_id).filter(Boolean)
            )];

            if (propertyIds.length > 0) {
              const sharedTypes = [
                "diagnostic_performance", "dpe", "erp", "crep", "amiante",
                "electricite", "gaz", "reglement_copro", "notice_information",
                "EDL_entree", "EDL_sortie", "edl", "edl_entree", "edl_sortie",
              ];

              propertyDocs = await queryDocumentsWithFallback(
                supabaseClient,
                SELECT_WITH_PROPERTY,
                (q: any) => q
                  .in("property_id", propertyIds)
                  .in("type", sharedTypes)
                  .order("created_at", { ascending: false })
              );
            }
          }

          const merged = [...(directDocs || []), ...leaseDocs, ...propertyDocs];
          allDocs = merged.reduce((acc, doc) => {
            if (!acc.find((d: any) => d.id === doc.id)) {
              acc.push(doc);
            }
            return acc;
          }, [] as DocumentRow[]);
        }

        let filtered = allDocs;

        if (!filters?.includeArchived) {
          filtered = filtered.filter((d: any) => !(d as any).is_archived);
        }
        if (filters?.propertyId) {
          filtered = filtered.filter((d: any) => d.property_id === filters.propertyId);
        }
        if (filters?.leaseId) {
          filtered = filtered.filter((d: any) => d.lease_id === filters.leaseId);
        }
        if (filters?.type) {
          filtered = filtered.filter((d: any) => d.type === filters.type);
        }

        filtered.sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });

        return filtered;
      }
      
      // ========================================
      // PROPRIÉTAIRE: Vue unifiée v_owner_accessible_documents (SOTA 2026)
      // Fallback sur requêtes manuelles si la vue n'existe pas
      // ========================================
      if (profile.role === "owner") {
        let allDocs: DocumentRow[] = [];
        let usedView = false;

        try {
          const { data: viewData, error: viewError } = await supabaseClient
            .from("v_owner_accessible_documents" as any)
            .select(SELECT_WITH_PROPERTY_AND_TENANT)
            .order("created_at", { ascending: false });

          if (!viewError && viewData) {
            allDocs = viewData as DocumentRow[];
            usedView = true;
          } else if (viewError) {
            console.warn("[useDocuments] v_owner_accessible_documents failed, falling back:", viewError);
          }
        } catch (e) {
          console.warn("[useDocuments] v_owner_accessible_documents threw, falling back:", e);
        }

        if (!usedView) {
          const { data: ownerProperties } = await supabaseClient
            .from("properties")
            .select("id")
            .eq("owner_id", profile.id);

          const propertyIds = ownerProperties?.map((p: any) => p.id) || [];

          const ownerDocs = await queryDocumentsWithFallback(
            supabaseClient,
            SELECT_WITH_PROPERTY_AND_TENANT,
            (q: any) => q.eq("owner_id", profile.id).order("created_at", { ascending: false })
          );
          allDocs = [...ownerDocs];

          if (propertyIds.length > 0) {
            const propertyDocs = await queryDocumentsWithFallback(
              supabaseClient,
              SELECT_WITH_PROPERTY_AND_TENANT,
              (q: any) => q.in("property_id", propertyIds).order("created_at", { ascending: false })
            );
            for (const doc of propertyDocs) {
              if (!allDocs.find(d => d.id === doc.id)) {
                allDocs.push(doc);
              }
            }
          }
        }

        let filtered = allDocs;

        if (!filters?.includeArchived) {
          filtered = filtered.filter((d: any) => !(d as any).is_archived);
        }
        if (filters?.propertyId) {
          filtered = filtered.filter((d: any) => d.property_id === filters.propertyId);
        }
        if (filters?.leaseId) {
          filtered = filtered.filter((d: any) => d.lease_id === filters.leaseId);
        }
        if (filters?.type) {
          filtered = filtered.filter((d: any) => d.type === filters.type);
        }

        filtered.sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });

        return filtered;
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
        
        const ticketIds = workOrders.map((wo: any) => wo.ticket_id);
        
        // Récupérer les property_ids des tickets
        const { data: tickets } = await supabaseClient
          .from("tickets")
          .select("property_id")
          .in("id", ticketIds);
        
        if (!tickets || tickets.length === 0) {
          return [];
        }
        
        const propertyIds = [...new Set(tickets.map((t: any) => t.property_id).filter(Boolean))];
        
        // Documents liés aux propriétés des interventions (devis, rapports, etc.)
        const providerDocs = await queryDocumentsWithFallback(
          supabaseClient,
          SELECT_WITH_PROPERTY,
          (q: any) => {
            let built = q
              .in("property_id", propertyIds)
              .in("type", ["devis", "ordre_mission", "rapport_intervention", "facture"])
              .order("created_at", { ascending: false });
            if (filters?.propertyId) {
              built = built.eq("property_id", filters.propertyId);
            }
            if (filters?.type) {
              built = built.eq("type", filters.type);
            }
            return built;
          }
        );
        return providerDocs;
      }
      
      // ========================================
      // ADMIN: Tous les documents (via RLS côté Supabase)
      // ========================================
      if (profile.role === "admin") {
        const adminDocs = await queryDocumentsWithFallback(
          supabaseClient,
          SELECT_WITH_PROPERTY_AND_TENANT,
          (q: any) => {
            let built = q.order("created_at", { ascending: false });
            if (filters?.propertyId) {
              built = built.eq("property_id", filters.propertyId);
            }
            if (filters?.leaseId) {
              built = built.eq("lease_id", filters.leaseId);
            }
            if (filters?.type) {
              built = built.eq("type", filters.type);
            }
            return built;
          }
        );
        return adminDocs;
      }
      
      // 🔒 SÉCURITÉ: Par défaut, aucun document
      console.error(`[SÉCURITÉ] Rôle non géré: ${profile.role}`);
      return [];
    },
    enabled: !!profile,
    retry: 1,
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

      // Tentative avec jointure property
      const { data, error } = await supabaseClient
        .from("documents")
        .select(SELECT_WITH_PROPERTY)
        .eq("id", documentId)
        .single();

      if (error) {
        // Si pas trouvé, c'est probablement une restriction RLS
        if (error.code === "PGRST116") {
          throw new Error("Document non trouvé ou accès refusé");
        }
        // Si erreur de relation, fallback sans jointure
        if (error.code === "PGRST200" || error.message?.includes("relationship") || error.code?.startsWith("4")) {
          console.warn("[useDocument] Join query failed, falling back:", error.message);
          const { data: fallbackData, error: fallbackError } = await supabaseClient
            .from("documents")
            .select("*")
            .eq("id", documentId)
            .single();
          if (fallbackError) {
            if (fallbackError.code === "PGRST116") {
              throw new Error("Document non trouvé ou accès refusé");
            }
            throw fallbackError;
          }
          return fallbackData as DocumentRow;
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
 * @deprecated Use useGedUpload instead. All document inserts must go through the API route.
 * This hook bypasses the GED upload pipeline (validation, virus scan, metadata extraction).
 * It remains exported only for backward compatibility — do NOT use in new code.
 *
 * 🔒 SÉCURITÉ: Lie automatiquement le document au profil de l'utilisateur
 */
export function useCreateDocument() {
  console.warn(
    "[useCreateDocument] DEPRECATED: This hook is forbidden by architecture rules. " +
    "Use useGedUpload instead. All document inserts must go through the API route."
  );
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

