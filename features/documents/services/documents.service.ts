import { apiClient } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { documentSchema, documentUpdateSchema } from "@/lib/validations";
import type { Document, DocumentType } from "@/lib/types";
import { isDocumentGalleryColumnError } from "@/lib/features/document-gallery";

export interface CreateDocumentData {
  type: DocumentType;
  property_id?: string | null;
  lease_id?: string | null;
  owner_id?: string | null;
  tenant_id?: string | null;
  file: File;
  collection?: string;
  title?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateDocumentData {
  type?: DocumentType;
  metadata?: Record<string, unknown>;
  title?: string | null;
  notes?: string | null;
  is_cover?: boolean;
  collection?: string | null;
  position?: number | null;
}

export class DocumentsService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }
  private supportsGallery: boolean | null = null;

  private sortDocuments(data: Document[]) {
    return data
      .slice()
      .sort((a, b) => {
        if ((a.collection || "") < (b.collection || "")) return -1;
        if ((a.collection || "") > (b.collection || "")) return 1;
        const posA = a.position ?? Number.MAX_SAFE_INTEGER;
        const posB = b.position ?? Number.MAX_SAFE_INTEGER;
        if (posA !== posB) return posA - posB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }

  /**
   * @deprecated Cette méthode ne devrait pas être utilisée sans filtre.
   * Utiliser getDocumentsByOwner, getDocumentsByTenant, ou getDocumentsByProperty à la place.
   * 
   * 🔒 SÉCURITÉ: Retourne un tableau vide pour éviter une fuite de données.
   */
  async getDocuments() {
    console.error(
      "[SÉCURITÉ] getDocuments() appelé sans filtre. " +
      "Utilisez getDocumentsByOwner(), getDocumentsByTenant(), ou getDocumentsByProperty() à la place."
    );
    // Retourner un tableau vide pour éviter d'exposer tous les documents
    return [];
  }

  async getDocumentById(id: string) {
    const { data, error } = await this.supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as Document;
  }

  async getDocumentsByProperty(propertyId: string, collection?: string) {
    // Utiliser l'API route pour éviter les problèmes RLS
    try {
      const url = new URL("/api/properties/" + propertyId + "/documents", window.location.origin);
      if (collection) {
        url.searchParams.set("collection", collection);
      }
      const response = await fetch(url.toString(), {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Erreur serveur" }));
        throw new Error(error.error || "Impossible de charger les documents");
      }
      const data = await response.json();
      return (data.documents || []) as Document[];
    } catch (error) {
      console.error("[DocumentsService] Erreur lors de la récupération via API:", error);
      // Fallback vers l'ancienne méthode si l'API échoue
      return this.fetchDocumentsWithFallback({ propertyId, collection });
    }
  }

  async getDocumentsByLease(leaseId: string, collection?: string) {
    return this.fetchDocumentsWithFallback({ leaseId, collection });
  }

  async getDocumentsByOwner(ownerId: string) {
    return this.fetchDocumentsWithFallback({ ownerId });
  }

  async getDocumentsByTenant(tenantId: string) {
    return this.fetchDocumentsWithFallback({ tenantId });
  }

  async uploadBatch(params: {
    propertyId?: string;
    leaseId?: string;
    collection?: string;
    type: DocumentType;
    files: File[];
    metadata?: Record<string, unknown>;
  }): Promise<Document[]> {
    if (!params.files || params.files.length === 0) {
      throw new Error("Aucun fichier sélectionné");
    }

    documentSchema.parse({
      type: params.type,
      property_id: params.propertyId,
      lease_id: params.leaseId,
      collection: params.collection,
    });

    const formData = new FormData();
    formData.append("type", params.type);
    if (params.propertyId) formData.append("propertyId", params.propertyId);
    if (params.leaseId) formData.append("leaseId", params.leaseId);
    if (params.collection) formData.append("collection", params.collection);
    if (params.metadata) {
      formData.append("metadata", JSON.stringify(params.metadata));
    }

    params.files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await apiClient.uploadFile<{ documents: Document[] }>("/documents/upload-batch", formData);
    return this.sortDocuments(response.documents);
  }

  async uploadDocument(data: CreateDocumentData) {
    const documents = await this.uploadBatch({
      propertyId: data.property_id ?? undefined,
      leaseId: data.lease_id ?? undefined,
      collection: data.collection,
      type: data.type,
      files: [data.file],
      metadata: data.metadata,
    });

    return documents[0];
  }

  async getDocumentUrl(document: Document): Promise<string> {
    const {
      data: { publicUrl },
    } = this.supabase.storage.from("documents").getPublicUrl(document.storage_path);
    return publicUrl;
  }

  async getSignedUrl(document: Document, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from("documents")
      .createSignedUrl(document.storage_path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }

  async updateDocument(id: string, data: UpdateDocumentData) {
    const validatedData = documentUpdateSchema.parse(data);

    const { data: document, error } = await (this.supabase
      .from("documents") as any)
      .update(validatedData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return document as Document;
  }

  async deleteDocument(id: string) {
    await apiClient.delete(`/documents/${id}`);
  }

  async reorderDocument(id: string, position: number) {
    await apiClient.patch(`/documents/${id}/reorder`, { position });
  }

  async setCover(id: string) {
    await apiClient.patch(`/documents/${id}/reorder`, { isCover: true });
  }

  private async orderDocumentsQuery(
    query: any,
    useGallery: boolean
  ): Promise<{ data: any[] | null; error: any | null }> {
    let builder: any = query.order("created_at", { ascending: false });
    if (useGallery) {
      builder = query
        .order("collection", { ascending: true })
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
    }
    const attempt = await builder;
    return attempt;
  }

  private shouldUseGalleryEnhancements() {
    return this.supportsGallery !== false;
  }

  private registerGalleryFallback(error: { message?: string } | null | undefined) {
    if (!isDocumentGalleryColumnError(error)) {
      return false;
    }
    this.supportsGallery = false;
    return true;
  }

  private buildDocumentsQuery({
    propertyId,
    leaseId,
    ownerId,
    tenantId,
    collection,
    useGallery,
  }: {
    propertyId?: string;
    leaseId?: string;
    ownerId?: string;
    tenantId?: string;
    collection?: string;
    useGallery: boolean;
  }) {
    let query = this.supabase.from("documents").select("*");
    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }
    if (leaseId) {
      query = query.eq("lease_id", leaseId);
    }
    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }
    if (collection && useGallery) {
      query = query.eq("collection", collection);
    }
    return query;
  }

  private async fetchDocumentsWithFallback(params: {
    propertyId?: string;
    leaseId?: string;
    ownerId?: string;
    tenantId?: string;
    collection?: string;
  }) {
    const useGallery = this.shouldUseGalleryEnhancements();
    let query = this.buildDocumentsQuery({ ...params, useGallery });
    let { data, error } = await this.orderDocumentsQuery(query, useGallery);

    if (error && useGallery && this.registerGalleryFallback(error)) {
      query = this.buildDocumentsQuery({ ...params, collection: undefined, useGallery: false });
      ({ data, error } = await this.orderDocumentsQuery(query, false));
    }

    if (error) throw error;
    const docs = data as Document[];
    if (this.supportsGallery === false && params.collection) {
      return this.sortDocuments(docs);
    }
    return this.sortDocuments(docs);
  }
}

export const documentsService = new DocumentsService();

