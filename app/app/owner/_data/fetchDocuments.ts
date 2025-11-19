/**
 * Data fetching pour les documents (Owner)
 * Server-side uniquement
 */

import { createClient } from "@/lib/supabase/server";

export interface DocumentRow {
  id: string;
  type: string;
  owner_id: string | null;
  tenant_id: string | null;
  property_id: string | null;
  lease_id: string | null;
  storage_path: string;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  title?: string | null;
  // Relations
  property?: {
      adresse_complete: string;
  }
}

export interface FetchDocumentsOptions {
  ownerId: string;
  propertyId?: string;
  leaseId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface DocumentsWithPagination {
  documents: DocumentRow[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Récupère les documents d'un propriétaire
 */
export async function fetchDocuments(
  options: FetchDocumentsOptions
): Promise<DocumentsWithPagination> {
  const supabase = await createClient();

  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Non authentifié");
  }

  // Vérifier les permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || profile.id !== options.ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Construire la requête
  let query = supabase
    .from("documents")
    .select(`
      *,
      property:properties (
        adresse_complete
      )
    `, { count: "exact" })
    .eq("owner_id", options.ownerId)
    .order("created_at", { ascending: false });

  // Filtrer par propriété si spécifié
  if (options.propertyId) {
    query = query.eq("property_id", options.propertyId);
  }

  // Filtrer par bail si spécifié
  if (options.leaseId) {
    query = query.eq("lease_id", options.leaseId);
  }

  // Filtrer par type si spécifié
  if (options.type) {
    query = query.eq("type", options.type);
  }

  // Pagination
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data: documents, error, count } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des documents: ${error.message}`);
  }

  return {
    documents: (documents as any[]) || [],
    total: count || 0,
    page: Math.floor(offset / limit) + 1,
    limit,
  };
}

/**
 * Récupère un document par ID
 */
export async function fetchDocument(
  documentId: string,
  ownerId: string
): Promise<DocumentRow | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Non authentifié");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || profile.id !== ownerId) {
    throw new Error("Accès non autorisé");
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select(`
      *,
      property:properties (
        adresse_complete
      )
    `)
    .eq("id", documentId)
    .eq("owner_id", ownerId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Non trouvé
    }
    throw new Error(`Erreur lors de la récupération du document: ${error.message}`);
  }

  return document as any;
}
