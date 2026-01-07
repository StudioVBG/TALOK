import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";

export interface EDL {
  id: string;
  lease_id: string;
  type: "entree" | "sortie";
  status: "draft" | "in_progress" | "completed" | "signed" | "disputed";
  scheduled_date?: string | null;
  completed_date?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EDLItem {
  id: string;
  edl_id: string;
  room_name: string;
  item_name: string;
  condition?: "neuf" | "bon" | "moyen" | "mauvais" | "tres_mauvais" | null;
  notes?: string | null;
  created_at: string;
}

export interface EDLMedia {
  id: string;
  edl_id: string;
  item_id?: string | null;
  storage_path: string;
  media_type: "photo" | "video";
  thumbnail_path?: string | null;
  taken_at: string;
  created_at: string;
}

export interface EDLSignature {
  id: string;
  edl_id: string;
  signer_user: string;
  signer_role: "owner" | "tenant" | "witness";
  signed_at: string;
  signature_image_path?: string | null;
  ip_inet?: string | null;
  user_agent?: string | null;
}

export interface CreateEDLData {
  lease_id: string;
  type: "entree" | "sortie";
  scheduled_date?: string;
}

export class EDLService {
  private supabase = createClient();

  /**
   * Récupérer un EDL
   */
  async getEDL(id: string): Promise<EDL | null> {
    const { data, error } = await this.supabase
      .from("edl")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data;
  }

  /**
   * Récupérer les EDL d'un bail
   */
  async getEDLsByLease(leaseId: string): Promise<EDL[]> {
    const { data, error } = await this.supabase
      .from("edl")
      .select("*")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Créer un EDL
   */
  async createEDL(data: CreateEDLData): Promise<EDL> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const { data: edl, error } = await this.supabase
      .from("edl")
      .insert({
        ...data,
        created_by: user.id,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;
    return edl;
  }

  /**
   * Mettre à jour le statut d'un EDL
   */
  async updateEDLStatus(
    id: string,
    status: EDL["status"]
  ): Promise<EDL> {
    const updates: any = { status };
    if (status === "completed" || status === "signed") {
      updates.completed_date = new Date().toISOString().split("T")[0];
    }

    const { data, error } = await this.supabase
      .from("edl")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les items d'un EDL
   */
  async getEDLItems(edlId: string): Promise<EDLItem[]> {
    const { data, error } = await this.supabase
      .from("edl_items")
      .select("*")
      .eq("edl_id", edlId)
      .order("room_name", { ascending: true })
      .order("item_name", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Ajouter des sections/items à un EDL
   */
  async addSections(
    edlId: string,
    sections: Array<{
      room_name: string;
      items: Array<Omit<EDLItem, "id" | "edl_id" | "created_at">>;
    }>
  ): Promise<{ items: EDLItem[] }> {
    const response = await apiClient.post<{ items: EDLItem[] }>(
      `/edl/${edlId}/sections`,
      { sections }
    );
    return response;
  }

  /**
   * Ajouter un item à un EDL (méthode de compatibilité)
   */
  async addEDLItem(
    edlId: string,
    item: Omit<EDLItem, "id" | "edl_id" | "created_at">
  ): Promise<EDLItem> {
    const { items } = await this.addSections(edlId, [
      { room_name: item.room_name, items: [item] },
    ]);
    return items[0];
  }

  /**
   * Récupérer les médias d'un EDL
   */
  async getEDLMedia(edlId: string): Promise<EDLMedia[]> {
    const { data, error } = await this.supabase
      .from("edl_media")
      .select("*")
      .eq("edl_id", edlId)
      .order("taken_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Uploader un média (photo/vidéo) pour un EDL
   */
  async uploadEDLMedia(
    edlId: string,
    file: File,
    itemId?: string
  ): Promise<EDLMedia> {
    const mediaType = file.type.startsWith("video/") ? "video" : "photo";
    const fileName = `edl/${edlId}/${Date.now()}_${file.name}`;

    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from("documents")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: media, error } = await this.supabase
      .from("edl_media")
      .insert({
        edl_id: edlId,
        item_id: itemId,
        storage_path: uploadData.path,
        media_type: mediaType,
      })
      .select()
      .single();

    if (error) throw error;
    return media;
  }

  /**
   * Signer un EDL
   */
  async signEDL(edlId: string): Promise<EDLSignature> {
    const response = await apiClient.post<{ signature: EDLSignature }>(
      `/edl/${edlId}/sign`
    );
    return response.signature;
  }
}

export const edlService = new EDLService();

