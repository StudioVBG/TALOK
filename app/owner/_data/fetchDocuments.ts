/**
 * Data fetching pour les documents (Owner)
 * Server-side uniquement
 */

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { DocumentRow as _DocumentRowBase, PropertyRow, ProfileRow } from "@/lib/supabase/database.types";

// Client service role pour bypass les RLS (évite la récursion infinie)
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configuration Supabase manquante");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

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
 * Note: On évite les jointures pour contourner les problèmes de récursion RLS
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
    redirect("/auth/signin");
  }

  // Utiliser le service client pour bypass les RLS (évite la récursion infinie sur lease_signers)
  const serviceClient = getServiceClient();

  // Vérifier les permissions avec le service client
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  const profileData = profile as ProfileRow | null;
  if (!profileData || profileData.role !== "owner" || profileData.id !== options.ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Requête SANS jointure pour éviter la récursion RLS
  let query = serviceClient
    .from("documents")
    .select("*", { count: "exact" })
    .eq("owner_id", options.ownerId)
    .or("is_archived.is.null,is_archived.eq.false")
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

  // Si des documents ont des property_id, récupérer les adresses séparément
  const docs = (documents || []) as DocumentRow[];
  const propertyIds = [...new Set(docs.filter(d => d.property_id).map(d => d.property_id).filter(Boolean))];
  
  let propertiesMap: Record<string, string> = {};
  
  if (propertyIds.length > 0) {
    const { data: properties } = await serviceClient
      .from("properties")
      .select("id, adresse_complete")
      .in("id", propertyIds);
    
    if (properties) {
      const propertyRows = properties as PropertyRow[];
      propertiesMap = propertyRows.reduce((acc: Record<string, string>, p) => {
        acc[p.id] = p.adresse_complete;
        return acc;
      }, {});
    }
  }

  // Enrichir les documents avec l'adresse de la propriété
  const enrichedDocuments = docs.map(doc => ({
    ...doc,
    property: doc.property_id ? { adresse_complete: propertiesMap[doc.property_id] || "" } : undefined,
  }));

  return {
    documents: enrichedDocuments,
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
    redirect("/auth/signin");
  }

  // Utiliser le service client pour bypass les RLS
  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  const profileData = profile as ProfileRow | null;
  if (!profileData || profileData.role !== "owner" || profileData.id !== ownerId) {
    throw new Error("Accès non autorisé");
  }

  type DocumentWithProperty = DocumentRow & {
    property: { adresse_complete: string } | null;
  };
  const { data: document, error } = await serviceClient
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

  return document as DocumentRow | null;
}
