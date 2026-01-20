/**
 * Service de Chat en temps réel
 * Gère les conversations et messages entre propriétaires et locataires
 */

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Conversation {
  id: string;
  property_id: string;
  lease_id?: string | null;
  owner_profile_id: string;
  tenant_profile_id: string;
  subject?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  status: "active" | "archived" | "closed";
  owner_unread_count: number;
  tenant_unread_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  owner_name?: string;
  tenant_name?: string;
  property_address?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  sender_role: "owner" | "tenant";
  content: string;
  content_type: "text" | "image" | "file" | "system";
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  read_at?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  // Joined data
  sender_name?: string;
  sender_avatar?: string | null;
}

export interface SendMessageData {
  conversation_id: string;
  content: string;
  content_type?: "text" | "image" | "file";
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  attachment_size?: number;
}

export interface CreateConversationData {
  property_id: string;
  lease_id?: string;
  owner_profile_id: string;
  tenant_profile_id: string;
  subject?: string;
  initial_message?: string;
}

class ChatService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }
  private channels: Map<string, RealtimeChannel> = new Map();
  private realtimeEnabled = true;

  /**
   * Vérifier si Realtime est activé
   */
  isRealtimeEnabled(): boolean {
    return this.realtimeEnabled;
  }

  /**
   * Réactiver Realtime (après une erreur temporaire)
   */
  enableRealtime(): void {
    this.realtimeEnabled = true;
  }

  /**
   * Récupérer toutes les conversations de l'utilisateur
   */
  async getConversations(): Promise<Conversation[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new Error("Profil non trouvé");

    const { data, error } = await this.supabase
      .from("conversations")
      .select(`
        *,
        owner:profiles!conversations_owner_profile_id_fkey (
          prenom,
          nom,
          avatar_url
        ),
        tenant:profiles!conversations_tenant_profile_id_fkey (
          prenom,
          nom,
          avatar_url
        ),
        property:properties (
          adresse_complete,
          ville
        )
      `)
      .or(`owner_profile_id.eq.${profile.id},tenant_profile_id.eq.${profile.id}`)
      .eq("status", "active")
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) throw error;

    return (data || []).map((conv: any) => ({
      ...conv,
      owner_name: `${conv.owner?.prenom || ""} ${conv.owner?.nom || ""}`.trim(),
      tenant_name: `${conv.tenant?.prenom || ""} ${conv.tenant?.nom || ""}`.trim(),
      property_address: conv.property ? `${conv.property.adresse_complete}, ${conv.property.ville}` : "",
    }));
  }

  /**
   * Récupérer une conversation par ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await this.supabase
      .from("conversations")
      .select(`
        *,
        owner:profiles!conversations_owner_profile_id_fkey (
          prenom,
          nom,
          avatar_url
        ),
        tenant:profiles!conversations_tenant_profile_id_fkey (
          prenom,
          nom,
          avatar_url
        ),
        property:properties (
          adresse_complete,
          ville
        )
      `)
      .eq("id", conversationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return {
      ...data,
      owner_name: `${data.owner?.prenom || ""} ${data.owner?.nom || ""}`.trim(),
      tenant_name: `${data.tenant?.prenom || ""} ${data.tenant?.nom || ""}`.trim(),
      property_address: data.property ? `${data.property.adresse_complete}, ${data.property.ville}` : "",
    };
  }

  /**
   * Créer ou récupérer une conversation existante
   */
  async getOrCreateConversation(data: CreateConversationData): Promise<Conversation> {
    // Vérifier si une conversation existe déjà
    const { data: existing, error: checkError } = await this.supabase
      .from("conversations")
      .select("*")
      .eq("property_id", data.property_id)
      .eq("owner_profile_id", data.owner_profile_id)
      .eq("tenant_profile_id", data.tenant_profile_id)
      .single();

    if (existing) {
      return existing;
    }

    // Créer une nouvelle conversation
    const { data: newConv, error } = await this.supabase
      .from("conversations")
      .insert({
        property_id: data.property_id,
        lease_id: data.lease_id,
        owner_profile_id: data.owner_profile_id,
        tenant_profile_id: data.tenant_profile_id,
        subject: data.subject,
      })
      .select()
      .single();

    if (error) throw error;

    // Envoyer le message initial si fourni
    if (data.initial_message && newConv) {
      const { data: profile } = await this.supabase
        .from("profiles")
        .select("id")
        .eq("user_id", (await this.supabase.auth.getUser()).data.user?.id)
        .single();

      const senderRole = profile?.id === data.owner_profile_id ? "owner" : "tenant";

      await this.sendMessage({
        conversation_id: newConv.id,
        content: data.initial_message,
      });
    }

    return newConv;
  }

  /**
   * Récupérer les messages d'une conversation
   */
  async getMessages(conversationId: string, limit = 50, before?: string): Promise<Message[]> {
    let query = this.supabase
      .from("messages")
      .select(`
        *,
        sender:profiles!messages_sender_profile_id_fkey (
          prenom,
          nom,
          avatar_url
        )
      `)
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).reverse().map((msg: any) => ({
      ...msg,
      sender_name: `${msg.sender?.prenom || ""} ${msg.sender?.nom || ""}`.trim(),
      sender_avatar: msg.sender?.avatar_url,
    }));
  }

  /**
   * Envoyer un message
   */
  async sendMessage(data: SendMessageData): Promise<Message> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new Error("Profil non trouvé");

    // Déterminer le rôle de l'expéditeur
    const { data: conversation } = await this.supabase
      .from("conversations")
      .select("owner_profile_id, tenant_profile_id")
      .eq("id", data.conversation_id)
      .single();

    if (!conversation) throw new Error("Conversation non trouvée");

    const senderRole = profile.id === conversation.owner_profile_id ? "owner" : "tenant";

    const { data: message, error } = await this.supabase
      .from("messages")
      .insert({
        conversation_id: data.conversation_id,
        sender_profile_id: profile.id,
        sender_role: senderRole,
        content: data.content,
        content_type: data.content_type || "text",
        attachment_url: data.attachment_url,
        attachment_name: data.attachment_name,
        attachment_type: data.attachment_type,
        attachment_size: data.attachment_size,
      })
      .select(`
        *,
        sender:profiles!messages_sender_profile_id_fkey (
          prenom,
          nom,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    return {
      ...message,
      sender_name: `${message.sender?.prenom || ""} ${message.sender?.nom || ""}`.trim(),
      sender_avatar: message.sender?.avatar_url,
    };
  }

  /**
   * Marquer les messages comme lus
   */
  async markAsRead(conversationId: string): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return;

    await this.supabase.rpc("mark_messages_as_read", {
      p_conversation_id: conversationId,
      p_reader_profile_id: profile.id,
    });
  }

  /**
   * Souscrire aux nouveaux messages en temps réel
   * Gère les erreurs WebSocket (notamment "The operation is insecure")
   */
  subscribeToMessages(
    conversationId: string,
    onMessage: (message: Message) => void
  ): () => void {
    // Vérifier si Realtime est disponible
    if (!this.realtimeEnabled) {
      console.warn("Realtime désactivé - les messages ne seront pas reçus en temps réel");
      return () => {};
    }

    const channelName = `messages:${conversationId}`;
    
    // Éviter les doubles souscriptions
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    try {
      const channel = this.supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            try {
              // Enrichir le message avec les données du sender
              const { data: sender } = await this.supabase
                .from("profiles")
                .select("prenom, nom, avatar_url")
                .eq("id", payload.new.sender_profile_id)
                .single();

              const message: Message = {
                ...(payload.new as any),
                sender_name: sender ? `${sender.prenom || ""} ${sender.nom || ""}`.trim() : "",
                sender_avatar: sender?.avatar_url,
              };

              onMessage(message);
            } catch (err) {
              console.error("Erreur enrichissement message:", err);
              onMessage(payload.new as Message);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("Erreur WebSocket messages:", err);
            this.realtimeEnabled = false;
          }
          if (err?.message?.includes("insecure")) {
            console.error("WebSocket non sécurisé:", err);
            this.realtimeEnabled = false;
          }
        });

      this.channels.set(channelName, channel);

      return () => {
        channel.unsubscribe();
        this.channels.delete(channelName);
      };
    } catch (error) {
      console.error("Erreur lors de la souscription aux messages:", error);
      this.realtimeEnabled = false;
      return () => {};
    }
  }

  /**
   * Souscrire aux mises à jour des conversations
   * Gère les erreurs WebSocket (notamment "The operation is insecure")
   */
  subscribeToConversations(
    onUpdate: (conversation: Conversation) => void
  ): () => void {
    // Vérifier si Realtime est disponible
    if (!this.realtimeEnabled) {
      console.warn("Realtime désactivé - les mises à jour ne seront pas reçues en temps réel");
      return () => {};
    }

    const channelName = "conversations:updates";
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    try {
      const channel = this.supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversations",
          },
          (payload) => {
            onUpdate(payload.new as Conversation);
          }
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("Erreur WebSocket Realtime:", err);
            this.realtimeEnabled = false;
          }
          if (err?.message?.includes("insecure")) {
            console.error("WebSocket non sécurisé:", err);
            this.realtimeEnabled = false;
          }
        });

      this.channels.set(channelName, channel);

      return () => {
        channel.unsubscribe();
        this.channels.delete(channelName);
      };
    } catch (error) {
      console.error("Erreur lors de la souscription aux conversations:", error);
      this.realtimeEnabled = false;
      return () => {};
    }
  }

  /**
   * Archiver une conversation
   */
  async archiveConversation(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from("conversations")
      .update({ status: "archived" })
      .eq("id", conversationId);

    if (error) throw error;
  }

  /**
   * Uploader un fichier pour le chat
   */
  async uploadAttachment(conversationId: string, file: File): Promise<{
    url: string;
    name: string;
    type: string;
    size: number;
  }> {
    const fileName = `chat/${conversationId}/${Date.now()}_${file.name}`;
    
    const { data, error } = await this.supabase.storage
      .from("documents")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = this.supabase.storage
      .from("documents")
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  }

  /**
   * Compter les messages non lus
   */
  async getUnreadCount(): Promise<number> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return 0;

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) return 0;

    const { data: conversations } = await this.supabase
      .from("conversations")
      .select("owner_unread_count, tenant_unread_count, owner_profile_id")
      .or(`owner_profile_id.eq.${profile.id},tenant_profile_id.eq.${profile.id}`);

    if (!conversations) return 0;

    return conversations.reduce((total, conv) => {
      const isOwner = conv.owner_profile_id === profile.id;
      return total + (isOwner ? conv.owner_unread_count : conv.tenant_unread_count);
    }, 0);
  }
}

export const chatService = new ChatService();

