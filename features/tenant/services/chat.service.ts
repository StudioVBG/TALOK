import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";

export interface ChatThread {
  id: string;
  lease_id: string;
  type: "owner_tenant" | "roommates" | "ticket" | "announcement";
  title?: string | null;
  ticket_id?: string | null;
  created_by: string;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_user: string;
  sender_profile_id: string;
  body: string;
  attachments: Array<{
    storage_path: string;
    file_name: string;
    mime_type: string;
  }>;
  read_by: Array<{
    user_id: string;
    read_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface CreateThreadData {
  lease_id: string;
  type: "owner_tenant" | "roommates" | "ticket" | "announcement";
  title?: string;
  ticket_id?: string;
}

export class ChatService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Récupérer les threads d'un bail
   */
  async getThreads(leaseId: string): Promise<ChatThread[]> {
    const { data, error } = await this.supabase
      .from("chat_threads")
      .select("*")
      .eq("lease_id", leaseId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Récupérer un thread
   */
  async getThread(id: string): Promise<ChatThread | null> {
    const { data, error } = await this.supabase
      .from("chat_threads")
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
   * Créer un thread
   */
  async createThread(data: CreateThreadData): Promise<ChatThread> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const { data: thread, error } = await this.supabase
      .from("chat_threads")
      .insert({
        ...data,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return thread;
  }

  /**
   * Récupérer les messages d'un thread
   */
  async getMessages(
    threadId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatMessage[]> {
    const response = await apiClient.get<{ messages: ChatMessage[] }>(
      `/chat/threads/${threadId}/messages?limit=${limit}&offset=${offset}`
    );
    return response.messages;
  }

  /**
   * Envoyer un message
   */
  async sendMessage(
    threadId: string,
    body: string,
    attachments?: File[]
  ): Promise<ChatMessage> {
    const formData = new FormData();
    formData.append("body", body);
    if (attachments && attachments.length > 0) {
      attachments.forEach((file) => {
        formData.append("attachments", file);
      });
    }

    const response = await apiClient.uploadFile<{ message: ChatMessage }>(
      `/chat/threads/${threadId}/messages`,
      formData
    );
    return response.message;
  }

  /**
   * Marquer un message comme lu
   */
  async markAsRead(threadId: string, messageId: string): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    // Récupérer le message actuel
    const { data: message, error: fetchError } = await this.supabase
      .from("chat_messages")
      .select("read_by")
      .eq("id", messageId)
      .single();

    if (fetchError) throw fetchError;

    // Ajouter l'utilisateur à la liste des lecteurs
    const readBy = message.read_by || [];
    const alreadyRead = readBy.some((r: any) => r.user_id === user.id);

    if (!alreadyRead) {
      readBy.push({
        user_id: user.id,
        read_at: new Date().toISOString(),
      });

      const { error } = await this.supabase
        .from("chat_messages")
        .update({ read_by: readBy })
        .eq("id", messageId);

      if (error) throw error;
    }
  }

  /**
   * S'abonner aux nouveaux messages (Realtime)
   */
  subscribeToMessages(
    threadId: string,
    callback: (message: ChatMessage) => void
  ) {
    return this.supabase
      .channel(`chat:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          callback(payload.new as ChatMessage);
        }
      )
      .subscribe();
  }
}

export const chatService = new ChatService();

