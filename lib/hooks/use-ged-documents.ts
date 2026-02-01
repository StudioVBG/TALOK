/**
 * Hook React Query pour le système GED (Gestion Électronique des Documents)
 *
 * Fournit:
 * - useGedDocuments: Liste des documents enrichis (vue v_documents_ged)
 * - useGedDocument: Document unique avec détails complets
 * - useGedDocumentTypes: Référentiel des types de documents
 * - useGedUpload: Upload avec rattachement GED
 * - useGedUpdateDocument: Mise à jour métadonnées GED
 * - useGedDeleteDocument: Suppression avec audit
 *
 * 🔒 SÉCURITÉ: Utilise le même pattern de filtrage par rôle que useDocuments
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import type {
  GedDocument,
  GedDocumentFilters,
  GedDocumentTypeRef,
  GedUploadInput,
  GedDocumentCategory,
  GedStatus,
} from "@/lib/types/ged";

// ============================================
// QUERY KEYS
// ============================================

export const gedQueryKeys = {
  all: ["ged"] as const,
  documents: (filters?: GedDocumentFilters) => [...gedQueryKeys.all, "documents", filters] as const,
  document: (id: string) => [...gedQueryKeys.all, "document", id] as const,
  types: () => [...gedQueryKeys.all, "types"] as const,
  alerts: (ownerId?: string) => [...gedQueryKeys.all, "alerts", ownerId] as const,
  alertsSummary: (ownerId?: string) => [...gedQueryKeys.all, "alerts-summary", ownerId] as const,
};

// ============================================
// RÉFÉRENTIEL TYPES
// ============================================

/**
 * Récupère le référentiel des types de documents GED
 */
export function useGedDocumentTypes() {
  return useQuery({
    queryKey: gedQueryKeys.types(),
    queryFn: async (): Promise<GedDocumentTypeRef[]> => {
      const supabase = getTypedSupabaseClient(typedSupabaseClient);
      const { data, error } = await supabase
        .from("ged_document_types")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return (data || []) as GedDocumentTypeRef[];
    },
    staleTime: 30 * 60 * 1000, // 30 min - référentiel stable
    gcTime: 60 * 60 * 1000,
  });
}

// ============================================
// LISTE DES DOCUMENTS GED
// ============================================

/**
 * Récupère les documents GED enrichis pour le propriétaire courant
 *
 * Utilise la vue v_documents_ged qui combine documents + ged_document_types
 * pour fournir les infos d'expiration et de catégorie.
 *
 * Pour les cas où la vue SQL n'est pas disponible (migration pas encore appliquée),
 * fait un fallback sur la table documents avec enrichissement côté client.
 */
export function useGedDocuments(filters?: GedDocumentFilters) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: gedQueryKeys.documents(filters),
    queryFn: async (): Promise<GedDocument[]> => {
      if (!profile) throw new Error("Non authentifié");
      if (profile.role !== "owner" && profile.role !== "admin") {
        return [];
      }

      const supabase = getTypedSupabaseClient(typedSupabaseClient);

      // Récupérer les propriétés du propriétaire
      const { data: ownerProperties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", profile.id);

      const propertyIds = ownerProperties?.map((p: { id: string }) => p.id) || [];

      if (propertyIds.length === 0 && profile.role !== "admin") {
        return [];
      }

      // Requête sur la table documents avec les colonnes GED
      // On fait un LEFT JOIN côté client avec le référentiel
      let query = supabase
        .from("documents")
        .select(`
          id, type, title, storage_path, file_size, mime_type, original_filename,
          owner_id, tenant_id, property_id, lease_id, entity_id,
          valid_from, valid_until, version, parent_document_id, is_current_version,
          ged_status, signed_at, tags, ged_ai_data, ged_ai_processed_at,
          created_at, updated_at, created_by,
          properties:property_id(id, adresse_complete, ville)
        `)
        .eq("is_current_version", true)
        .order("created_at", { ascending: false });

      // Filtrage par propriétaire: owner_id OU property_id dans ses propriétés
      if (profile.role === "owner") {
        query = query.or(
          `owner_id.eq.${profile.id},property_id.in.(${propertyIds.join(",")})`
        );
      }

      // Filtres additionnels
      if (!filters?.includeArchived) {
        query = query.neq("is_archived", true);
      }
      if (filters?.propertyId) {
        query = query.eq("property_id", filters.propertyId);
      }
      if (filters?.leaseId) {
        query = query.eq("lease_id", filters.leaseId);
      }
      if (filters?.entityId) {
        query = query.eq("entity_id", filters.entityId);
      }
      if (filters?.type) {
        query = query.eq("type", filters.type);
      }
      if (filters?.gedStatus) {
        query = query.eq("ged_status", filters.gedStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrichir les documents avec les infos du référentiel
      const docs = (data || []).map((doc: Record<string, unknown>) => enrichDocument(doc));

      // Filtres côté client
      let result = docs;

      if (filters?.category) {
        result = result.filter((d: GedDocument) => d.type_category === filters.category);
      }
      if (filters?.expiryStatus) {
        result = result.filter((d: GedDocument) => d.expiry_status === filters.expiryStatus);
      }
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        result = result.filter((d: GedDocument) =>
          (d.title && d.title.toLowerCase().includes(search)) ||
          (d.type_label && d.type_label.toLowerCase().includes(search)) ||
          (d.original_filename && d.original_filename.toLowerCase().includes(search)) ||
          (d.tags && d.tags.some(t => t.toLowerCase().includes(search)))
        );
      }

      return result;
    },
    enabled: !!profile,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ============================================
// DOCUMENT UNIQUE
// ============================================

export function useGedDocument(id: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: gedQueryKeys.document(id),
    queryFn: async (): Promise<GedDocument | null> => {
      if (!profile || !id) return null;

      const supabase = getTypedSupabaseClient(typedSupabaseClient);
      const { data, error } = await supabase
        .from("documents")
        .select(`
          id, type, title, storage_path, file_size, mime_type, original_filename,
          owner_id, tenant_id, property_id, lease_id, entity_id,
          valid_from, valid_until, version, parent_document_id, is_current_version,
          ged_status, signed_at, tags, ged_ai_data, ged_ai_processed_at,
          created_at, updated_at, created_by,
          properties:property_id(id, adresse_complete, ville)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!data) return null;

      return enrichDocument(data as Record<string, unknown>);
    },
    enabled: !!profile && !!id,
  });
}

// ============================================
// UPLOAD GED
// ============================================

export function useGedUpload() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: GedUploadInput): Promise<GedDocument> => {
      if (!profile) throw new Error("Non authentifié");

      const formData = new FormData();
      formData.append("file", input.file);
      formData.append("type", input.type);
      if (input.title) formData.append("title", input.title);
      if (input.property_id) formData.append("property_id", input.property_id);
      if (input.lease_id) formData.append("lease_id", input.lease_id);
      if (input.entity_id) formData.append("entity_id", input.entity_id);
      if (input.valid_from) formData.append("valid_from", input.valid_from);
      if (input.valid_until) formData.append("valid_until", input.valid_until);
      if (input.tags && input.tags.length > 0) {
        formData.append("tags", JSON.stringify(input.tags));
      }

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erreur lors de l'upload");
      }

      const result = await response.json();
      return enrichDocument(result.document || result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gedQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

// ============================================
// UPDATE GED
// ============================================

export function useGedUpdateDocument() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        title: string;
        type: string;
        valid_from: string | null;
        valid_until: string | null;
        ged_status: GedStatus;
        tags: string[];
        entity_id: string | null;
        property_id: string | null;
        lease_id: string | null;
      }>;
    }) => {
      if (!profile) throw new Error("Non authentifié");

      const supabase = getTypedSupabaseClient(typedSupabaseClient);
      const { data, error } = await supabase
        .from("documents")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: gedQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({
        queryKey: gedQueryKeys.document(variables.id),
      });
    },
  });
}

// ============================================
// DELETE
// ============================================

export function useGedDeleteDocument() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!profile) throw new Error("Non authentifié");

      const supabase = getTypedSupabaseClient(typedSupabaseClient);
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gedQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

// ============================================
// HELPERS
// ============================================

/**
 * Enrichit un document avec les infos du référentiel GED.
 * Calcule expiry_status et days_until_expiry côté client.
 */
function enrichDocument(doc: Record<string, unknown>): GedDocument {
  const typeInfo = DOCUMENT_TYPE_MAP[doc.type as string];
  const validUntil = doc.valid_until as string | null;

  let expiryStatus: GedDocument["expiry_status"] = null;
  let daysUntilExpiry: number | null = null;

  if (validUntil) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expDate = new Date(validUntil);
    expDate.setHours(0, 0, 0, 0);
    daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      expiryStatus = "expired";
    } else if (daysUntilExpiry <= 30) {
      expiryStatus = "expiring_soon";
    } else if (daysUntilExpiry <= 90) {
      expiryStatus = "expiring_notice";
    } else {
      expiryStatus = "valid";
    }
  }

  const property = doc.properties as GedDocument["property"] ?? null;

  return {
    id: doc.id as string,
    type: doc.type as GedDocument["type"],
    title: (doc.title as string) || null,
    storage_path: doc.storage_path as string,
    file_size: (doc.file_size as number) || null,
    mime_type: (doc.mime_type as string) || null,
    original_filename: (doc.original_filename as string) || null,
    owner_id: (doc.owner_id as string) || null,
    tenant_id: (doc.tenant_id as string) || null,
    property_id: (doc.property_id as string) || null,
    lease_id: (doc.lease_id as string) || null,
    entity_id: (doc.entity_id as string) || null,
    valid_from: (doc.valid_from as string) || null,
    valid_until: validUntil,
    version: (doc.version as number) || 1,
    parent_document_id: (doc.parent_document_id as string) || null,
    is_current_version: doc.is_current_version !== false,
    ged_status: (doc.ged_status as GedDocument["ged_status"]) || "active",
    signed_at: (doc.signed_at as string) || null,
    tags: (doc.tags as string[]) || [],
    ged_ai_data: (doc.ged_ai_data as Record<string, unknown>) || null,
    ged_ai_processed_at: (doc.ged_ai_processed_at as string) || null,
    created_at: doc.created_at as string,
    updated_at: doc.updated_at as string,
    created_by: (doc.created_by as string) || null,
    // Enrichi
    type_label: typeInfo?.label || null,
    type_label_short: typeInfo?.label_short || null,
    type_icon: typeInfo?.icon || null,
    type_category: (typeInfo?.category as GedDocumentCategory) || null,
    is_expirable: typeInfo?.is_expirable || null,
    is_mandatory_for_lease: typeInfo?.is_mandatory_for_lease || null,
    expiry_status: expiryStatus,
    days_until_expiry: daysUntilExpiry,
    property,
  };
}

/**
 * Map statique du référentiel des types de documents.
 * Utilisé pour l'enrichissement côté client sans requête supplémentaire.
 */
const DOCUMENT_TYPE_MAP: Record<string, {
  label: string;
  label_short: string;
  icon: string;
  category: string;
  is_expirable: boolean;
  is_mandatory_for_lease: boolean;
}> = {
  bail: { label: "Bail de location", label_short: "Bail", icon: "FileText", category: "legal", is_expirable: false, is_mandatory_for_lease: true },
  avenant: { label: "Avenant au bail", label_short: "Avenant", icon: "FilePlus", category: "legal", is_expirable: false, is_mandatory_for_lease: false },
  engagement_garant: { label: "Acte de cautionnement", label_short: "Caution", icon: "Shield", category: "legal", is_expirable: false, is_mandatory_for_lease: false },
  bail_signe_locataire: { label: "Bail signé locataire", label_short: "Bail signé", icon: "FileCheck", category: "legal", is_expirable: false, is_mandatory_for_lease: false },
  bail_signe_proprietaire: { label: "Bail signé propriétaire", label_short: "Bail signé", icon: "FileCheck", category: "legal", is_expirable: false, is_mandatory_for_lease: false },
  consentement: { label: "Consentement RGPD", label_short: "RGPD", icon: "ShieldCheck", category: "legal", is_expirable: false, is_mandatory_for_lease: false },
  dpe: { label: "DPE", label_short: "DPE", icon: "Thermometer", category: "diagnostic", is_expirable: true, is_mandatory_for_lease: true },
  diagnostic_gaz: { label: "Diagnostic Gaz", label_short: "Gaz", icon: "Flame", category: "diagnostic", is_expirable: true, is_mandatory_for_lease: true },
  diagnostic_electricite: { label: "Diagnostic Électricité", label_short: "Élec.", icon: "Zap", category: "diagnostic", is_expirable: true, is_mandatory_for_lease: true },
  diagnostic_plomb: { label: "Diagnostic Plomb (CREP)", label_short: "Plomb", icon: "AlertTriangle", category: "diagnostic", is_expirable: true, is_mandatory_for_lease: true },
  diagnostic_amiante: { label: "Diagnostic Amiante", label_short: "Amiante", icon: "AlertTriangle", category: "diagnostic", is_expirable: true, is_mandatory_for_lease: false },
  diagnostic_termites: { label: "Diagnostic Termites", label_short: "Termites", icon: "Bug", category: "diagnostic", is_expirable: true, is_mandatory_for_lease: false },
  erp: { label: "ERP", label_short: "ERP", icon: "MapPin", category: "diagnostic", is_expirable: true, is_mandatory_for_lease: true },
  diagnostic: { label: "DDT", label_short: "DDT", icon: "FileSearch", category: "diagnostic", is_expirable: false, is_mandatory_for_lease: false },
  diagnostic_tertiaire: { label: "Diagnostic tertiaire", label_short: "Tertiaire", icon: "Building", category: "diagnostic", is_expirable: true, is_mandatory_for_lease: false },
  diagnostic_performance: { label: "Diagnostic performance", label_short: "Perf.", icon: "BarChart", category: "diagnostic", is_expirable: true, is_mandatory_for_lease: false },
  attestation_assurance: { label: "Attestation assurance habitation", label_short: "Assurance", icon: "ShieldCheck", category: "insurance", is_expirable: true, is_mandatory_for_lease: true },
  assurance_pno: { label: "Assurance PNO", label_short: "PNO", icon: "Shield", category: "insurance", is_expirable: true, is_mandatory_for_lease: false },
  quittance: { label: "Quittance de loyer", label_short: "Quittance", icon: "Receipt", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  facture: { label: "Facture", label_short: "Facture", icon: "Receipt", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  rib: { label: "RIB", label_short: "RIB", icon: "CreditCard", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  avis_imposition: { label: "Avis d'imposition", label_short: "Impôts", icon: "FileText", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  bulletin_paie: { label: "Bulletin de paie", label_short: "Paie", icon: "FileText", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  attestation_loyer: { label: "Attestation de loyer", label_short: "Att. loyer", icon: "FileText", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  justificatif_revenus: { label: "Justificatif de revenus", label_short: "Revenus", icon: "FileText", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  taxe_fonciere: { label: "Taxe foncière", label_short: "Taxe fonc.", icon: "FileText", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  taxe_sejour: { label: "Taxe de séjour", label_short: "Taxe séjour", icon: "FileText", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  piece_identite: { label: "Pièce d'identité", label_short: "ID", icon: "User", category: "identity", is_expirable: true, is_mandatory_for_lease: false },
  cni_recto: { label: "CNI (recto)", label_short: "CNI recto", icon: "CreditCard", category: "identity", is_expirable: true, is_mandatory_for_lease: false },
  cni_verso: { label: "CNI (verso)", label_short: "CNI verso", icon: "CreditCard", category: "identity", is_expirable: true, is_mandatory_for_lease: false },
  passeport: { label: "Passeport", label_short: "Passeport", icon: "BookOpen", category: "identity", is_expirable: true, is_mandatory_for_lease: false },
  titre_sejour: { label: "Titre de séjour", label_short: "Titre séjour", icon: "FileText", category: "identity", is_expirable: true, is_mandatory_for_lease: false },
  EDL_entree: { label: "EDL d'entrée", label_short: "EDL entrée", icon: "ClipboardCheck", category: "edl", is_expirable: false, is_mandatory_for_lease: true },
  EDL_sortie: { label: "EDL de sortie", label_short: "EDL sortie", icon: "ClipboardCheck", category: "edl", is_expirable: false, is_mandatory_for_lease: false },
  inventaire: { label: "Inventaire mobilier", label_short: "Inventaire", icon: "List", category: "edl", is_expirable: false, is_mandatory_for_lease: false },
  candidature_identite: { label: "Candidature - Identité", label_short: "ID candidat", icon: "UserCheck", category: "identity", is_expirable: false, is_mandatory_for_lease: false },
  candidature_revenus: { label: "Candidature - Revenus", label_short: "Revenus candidat", icon: "DollarSign", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  candidature_domicile: { label: "Candidature - Domicile", label_short: "Domicile candidat", icon: "Home", category: "identity", is_expirable: false, is_mandatory_for_lease: false },
  candidature_garantie: { label: "Candidature - Garantie", label_short: "Garantie candidat", icon: "Shield", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  garant_identite: { label: "Garant - Identité", label_short: "ID garant", icon: "UserCheck", category: "identity", is_expirable: false, is_mandatory_for_lease: false },
  garant_revenus: { label: "Garant - Revenus", label_short: "Revenus garant", icon: "DollarSign", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  garant_domicile: { label: "Garant - Domicile", label_short: "Domicile garant", icon: "Home", category: "identity", is_expirable: false, is_mandatory_for_lease: false },
  garant_engagement: { label: "Garant - Engagement", label_short: "Engagement", icon: "FileSignature", category: "legal", is_expirable: false, is_mandatory_for_lease: false },
  devis: { label: "Devis", label_short: "Devis", icon: "Calculator", category: "maintenance", is_expirable: false, is_mandatory_for_lease: false },
  ordre_mission: { label: "Ordre de mission", label_short: "Ordre mission", icon: "ClipboardList", category: "maintenance", is_expirable: false, is_mandatory_for_lease: false },
  rapport_intervention: { label: "Rapport d'intervention", label_short: "Rapport", icon: "FileText", category: "maintenance", is_expirable: false, is_mandatory_for_lease: false },
  copropriete: { label: "Règlement de copropriété", label_short: "Règl. copro", icon: "Building", category: "administrative", is_expirable: false, is_mandatory_for_lease: false },
  proces_verbal: { label: "PV d'AG", label_short: "PV AG", icon: "FileText", category: "administrative", is_expirable: false, is_mandatory_for_lease: false },
  appel_fonds: { label: "Appel de fonds", label_short: "Appel fonds", icon: "Receipt", category: "financial", is_expirable: false, is_mandatory_for_lease: false },
  annexe_pinel: { label: "Annexe Pinel", label_short: "Pinel", icon: "FileText", category: "administrative", is_expirable: false, is_mandatory_for_lease: false },
  etat_travaux: { label: "État des travaux", label_short: "Travaux", icon: "Wrench", category: "administrative", is_expirable: false, is_mandatory_for_lease: false },
  publication_jal: { label: "Publication JAL", label_short: "JAL", icon: "Newspaper", category: "administrative", is_expirable: false, is_mandatory_for_lease: false },
  courrier: { label: "Courrier", label_short: "Courrier", icon: "Mail", category: "other", is_expirable: false, is_mandatory_for_lease: false },
  photo: { label: "Photo", label_short: "Photo", icon: "Camera", category: "other", is_expirable: false, is_mandatory_for_lease: false },
  autre: { label: "Autre document", label_short: "Autre", icon: "File", category: "other", is_expirable: false, is_mandatory_for_lease: false },
};
