/**
 * Hook React Query pour les documents
 * 
 * Utilise les types Database générés depuis Supabase
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import type { Database } from "@/lib/supabase/database.types";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

type DocumentRow = {
  id: string;
  owner_id?: string | null;
  tenant_id?: string | null;
  property_id?: string | null;
  lease_id?: string | null;
  type: string;
  storage_path: string;
  metadata?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
};
type DocumentInsert = Partial<DocumentRow>;
type DocumentUpdate = Partial<DocumentRow>;

/**
 * Hook pour récupérer tous les documents de l'utilisateur
 */
export function useDocuments(filters?: {
  propertyId?: string | null;
  leaseId?: string | null;
  type?: string;
}) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["documents", profile?.id, filters],
    queryFn: async () => {
      if (!profile) throw new Error("Non authentifié");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      let query = supabaseClient
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (filters?.propertyId) {
        query = query.eq("property_id", filters.propertyId);
      }
      
      if (filters?.leaseId) {
        query = query.eq("lease_id", filters.leaseId);
      }
      
      if (filters?.type) {
        query = query.eq("type", filters.type);
      }
      
      // Filtrer selon le rôle
      if (profile.role === "owner") {
        query = query.eq("owner_id", profile.id);
      } else if (profile.role === "tenant") {
        query = query.eq("tenant_id", profile.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as DocumentRow[];
    },
    enabled: !!profile,
  });
}

/**
 * Hook pour récupérer un document par ID
 */
export function useDocument(documentId: string | null) {
  return useQuery({
    queryKey: ["document", documentId],
    queryFn: async () => {
      if (!documentId) throw new Error("Document ID requis");
      
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data, error } = await supabaseClient
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single();
      
      if (error) throw error;
      return data as DocumentRow;
    },
    enabled: !!documentId,
  });
}

/**
 * Hook pour créer un document
 */
export function useCreateDocument() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (data: DocumentInsert) => {
      if (!profile) throw new Error("Non authentifié");
      
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
 */
export function useUpdateDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DocumentUpdate }) => {
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { data: document, error } = await supabaseClient
        .from("documents")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
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
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const supabaseClient = getTypedSupabaseClient(typedSupabaseClient);
      const { error } = await supabaseClient
        .from("documents")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

