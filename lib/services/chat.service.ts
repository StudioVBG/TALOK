/**
 * Service de Chat en temps réel
 * Gère les conversations et messages entre propriétaires et locataires
 *
 * IMPORTANT — Exécution côté navigateur uniquement.
 * Ce service est importé par des composants `"use client"` (MessagesPageContent,
 * ConversationsList, ChatWindow). Le client Supabase utilisé ici est donc
 * OBLIGATOIREMENT le client browser (createClient de @/lib/supabase/client),
 * user-scoped via cookies, soumis à RLS.
 *
 * Ne PAS importer `getServiceClient()` ici : la service role key ne doit
 * JAMAIS atterrir dans le bundle navigateur (exposerait un bypass total des
 * RLS à tout visiteur). Pour les opérations nécessitant un bypass RLS
 * contrôlé, passer par une route API (ex. /api/messages/*).
 *
 * Risque 42P17 (recursion sur profiles) : éliminé côté DB par la migration
 * `20260213000000_fix_profiles_rls_recursion_v2.sql` — les policies actives
 * utilisent des helpers SECURITY DEFINER (`get_my_profile_id()`, `is_admin()`)
 * qui bypassent la récursion. Les queries profiles depuis le browser client
 * sont donc sûres.
 */

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type ConversationType = "owner_tenant" | "owner_provider" | "tenant_provider";
export type SenderRole = "owner" | "tenant" | "provider";

export interface Conversation {
  id: string;
  conversation_type: ConversationType;
  property_id: string;
  lease_id?: string | null;
  ticket_id?: string | null;
  owner_profile_id: string | null;
  tenant_profile_id: string | null;
  provider_profile_id: string | null;
  subject?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  status: "active" | "archived" | "closed";
  owner_unread_count: number;
  tenant_unread_count: number;
  provider_unread_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  owner_name?: string;
  tenant_name?: string;
  provider_name?: string;
  owner_prenom?: string | null;
  owner_nom?: string | null;
  tenant_prenom?: string | null;
  tenant_nom?: string | null;
  provider_prenom?: string | null;
  provider_nom?: string | null;
  owner_avatar?: string | null;
  tenant_avatar?: string | null;
  provider_avatar?: string | null;
  property_address?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  sender_role: SenderRole;
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

export interface CreateOwnerProviderConversationData {
  ticket_id: string;
  property_id: string;
  owner_profile_id: string;
  provider_profile_id: string;
  subject?: string;
  initial_message?: string;
}

export interface CreateTenantProviderConversationData {
  ticket_id: string;
  property_id: string;
  tenant_profile_id: string;
  provider_profile_id: string;
  subject?: string;
  initial_message?: string;
}

export interface GetConversationsFilter {
  type?: ConversationType;
}

class ChatService {
  private supabase = createClient();
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
   * Récupérer toutes les conversations de l'utilisateur.
   * Filtre optionnel par conversation_type pour segmenter par feature UI
   * (ex: liste locataire vs liste tickets/prestataires).
   */
  async getConversations(filter: GetConversationsFilter = {}): Promise<Conversation[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profil non trouvé");

    let query = this.supabase
      .from("conversations")
      .select(`
        *,
        owner:profiles!conversations_owner_profile_id_fkey (
          id,
          prenom,
          nom,
          avatar_url
        ),
        tenant:profiles!conversations_tenant_profile_id_fkey (
          id,
          prenom,
          nom,
          avatar_url
        ),
        provider:profiles!conversations_provider_profile_id_fkey (
          id,
          prenom,
          nom,
          avatar_url
        ),
        property:properties (
          adresse_complete,
          ville
        )
      `)
      .or(`owner_profile_id.eq.${profile.id},tenant_profile_id.eq.${profile.id},provider_profile_id.eq.${profile.id}`)
      .eq("status", "active")
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (filter.type) {
      query = query.eq("conversation_type", filter.type);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Fallback : si l'embed FK ne renvoie pas le profil (cas RLS/visibilité
    // où PostgREST embedde `null`), on résout les profils manquants via une
    // seconde requête ciblée.
    //
    // Browser client (user-scoped) volontaire : getServiceClient() est interdit
    // côté client (leak service role). Cette requête reste soumise aux RLS v2
    // de `profiles` (policy `profiles_owner_read_tenants` via lease_signers,
    // helpers SECURITY DEFINER anti-recursion 42P17). Si la RLS refuse, on
    // retombe proprement sur `"Utilisateur"` côté UI — c'est le comportement
    // voulu (pas de bypass silencieux).
    const missingProfileIds = new Set<string>();
    for (const conv of (data || []) as any[]) {
      if (conv.owner_profile_id && !conv.owner?.prenom && !conv.owner?.nom) {
        missingProfileIds.add(conv.owner_profile_id);
      }
      if (conv.tenant_profile_id && !conv.tenant?.prenom && !conv.tenant?.nom) {
        missingProfileIds.add(conv.tenant_profile_id);
      }
      if (conv.provider_profile_id && !conv.provider?.prenom && !conv.provider?.nom) {
        missingProfileIds.add(conv.provider_profile_id);
      }
    }
    const profileMap = new Map<string, { prenom?: string; nom?: string; avatar_url?: string | null }>();
    if (missingProfileIds.size > 0) {
      const { data: profs } = await this.supabase
        .from("profiles")
        .select("id, prenom, nom, avatar_url")
        .in("id", Array.from(missingProfileIds));
      for (const p of (profs || []) as any[]) {
        profileMap.set(p.id, { prenom: p.prenom, nom: p.nom, avatar_url: p.avatar_url });
      }
    }

    return (data || []).map((conv: any) => {
      const owner = conv.owner?.prenom || conv.owner?.nom
        ? conv.owner
        : profileMap.get(conv.owner_profile_id);
      const tenant = conv.tenant?.prenom || conv.tenant?.nom
        ? conv.tenant
        : profileMap.get(conv.tenant_profile_id);
      const provider = conv.provider?.prenom || conv.provider?.nom
        ? conv.provider
        : profileMap.get(conv.provider_profile_id);
      return {
        ...conv,
        owner_prenom: owner?.prenom || null,
        owner_nom: owner?.nom || null,
        tenant_prenom: tenant?.prenom || null,
        tenant_nom: tenant?.nom || null,
        provider_prenom: provider?.prenom || null,
        provider_nom: provider?.nom || null,
        owner_name: `${owner?.prenom || ""} ${owner?.nom || ""}`.trim(),
        tenant_name: `${tenant?.prenom || ""} ${tenant?.nom || ""}`.trim(),
        provider_name: `${provider?.prenom || ""} ${provider?.nom || ""}`.trim(),
        owner_avatar: owner?.avatar_url || null,
        tenant_avatar: tenant?.avatar_url || null,
        provider_avatar: provider?.avatar_url || null,
        property_address: conv.property?.adresse_complete || "",
      };
    });
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
        provider:profiles!conversations_provider_profile_id_fkey (
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

    const d = data as any;
    return {
      ...d,
      owner_prenom: d.owner?.prenom || null,
      owner_nom: d.owner?.nom || null,
      tenant_prenom: d.tenant?.prenom || null,
      tenant_nom: d.tenant?.nom || null,
      provider_prenom: d.provider?.prenom || null,
      provider_nom: d.provider?.nom || null,
      owner_name: `${d.owner?.prenom || ""} ${d.owner?.nom || ""}`.trim(),
      tenant_name: `${d.tenant?.prenom || ""} ${d.tenant?.nom || ""}`.trim(),
      provider_name: `${d.provider?.prenom || ""} ${d.provider?.nom || ""}`.trim(),
      owner_avatar: d.owner?.avatar_url || null,
      tenant_avatar: d.tenant?.avatar_url || null,
      provider_avatar: d.provider?.avatar_url || null,
      property_address: d.property?.adresse_complete || "",
    } as Conversation;
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
      // Re-fetch avec les données jointes (profiles, property)
      const full = await this.getConversation(existing.id);
      if (full) return full;
      return existing as unknown as Conversation;
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
      await this.sendMessage({
        conversation_id: newConv.id,
        content: data.initial_message,
      });
    }

    // Re-fetch avec les données jointes
    const fullNew = await this.getConversation(newConv.id);
    if (fullNew) return fullNew;
    return newConv as unknown as Conversation;
  }

  /**
   * Créer ou récupérer une conversation owner↔provider (liée à un ticket).
   * UNIQUE partiel sur (ticket_id, owner_profile_id, provider_profile_id)
   * WHERE status='active' AND conversation_type='owner_provider' (migration Sprint 1).
   */
  async getOrCreateOwnerProviderConversation(
    data: CreateOwnerProviderConversationData
  ): Promise<Conversation> {
    const { data: existing } = await this.supabase
      .from("conversations")
      .select("id")
      .eq("conversation_type", "owner_provider")
      .eq("ticket_id", data.ticket_id)
      .eq("owner_profile_id", data.owner_profile_id)
      .eq("provider_profile_id", data.provider_profile_id)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      const full = await this.getConversation(existing.id);
      if (full) return full;
    }

    const { data: newConv, error } = await this.supabase
      .from("conversations")
      .insert({
        conversation_type: "owner_provider",
        ticket_id: data.ticket_id,
        property_id: data.property_id,
        owner_profile_id: data.owner_profile_id,
        provider_profile_id: data.provider_profile_id,
        subject: data.subject || "Conversation prestataire",
      } as any)
      .select()
      .single();

    if (error) throw error;

    if (data.initial_message && newConv) {
      await this.sendMessage({
        conversation_id: newConv.id,
        content: data.initial_message,
      });
    }

    const full = await this.getConversation(newConv.id);
    if (full) return full;
    return newConv as unknown as Conversation;
  }

  /**
   * Créer ou récupérer une conversation tenant↔provider (liée à un ticket).
   * UNIQUE partiel sur (ticket_id, tenant_profile_id, provider_profile_id)
   * WHERE status='active' AND conversation_type='tenant_provider' (migration Sprint 1).
   */
  async getOrCreateTenantProviderConversation(
    data: CreateTenantProviderConversationData
  ): Promise<Conversation> {
    const { data: existing } = await this.supabase
      .from("conversations")
      .select("id")
      .eq("conversation_type", "tenant_provider")
      .eq("ticket_id", data.ticket_id)
      .eq("tenant_profile_id", data.tenant_profile_id)
      .eq("provider_profile_id", data.provider_profile_id)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      const full = await this.getConversation(existing.id);
      if (full) return full;
    }

    const { data: newConv, error } = await this.supabase
      .from("conversations")
      .insert({
        conversation_type: "tenant_provider",
        ticket_id: data.ticket_id,
        property_id: data.property_id,
        tenant_profile_id: data.tenant_profile_id,
        provider_profile_id: data.provider_profile_id,
        subject: data.subject || "Conversation prestataire",
      } as any)
      .select()
      .single();

    if (error) throw error;

    if (data.initial_message && newConv) {
      await this.sendMessage({
        conversation_id: newConv.id,
        content: data.initial_message,
      });
    }

    const full = await this.getConversation(newConv.id);
    if (full) return full;
    return newConv as unknown as Conversation;
  }

  /**
   * Créer ou récupérer une conversation liée à un ticket
   */
  async getOrCreateTicketConversation(data: {
    ticket_id: string;
    property_id: string;
    owner_profile_id: string;
    tenant_profile_id: string;
    subject?: string;
  }): Promise<Conversation> {
    // Chercher une conversation existante liée au ticket
    const { data: existing } = await (this.supabase
      .from("conversations")
      .select("*") as any)
      .eq("ticket_id", data.ticket_id)
      .single();

    if (existing) {
      return existing as Conversation;
    }

    // Créer une nouvelle conversation liée au ticket
    const { data: newConv, error } = await this.supabase
      .from("conversations")
      .insert({
        property_id: data.property_id,
        ticket_id: data.ticket_id,
        owner_profile_id: data.owner_profile_id,
        tenant_profile_id: data.tenant_profile_id,
        subject: data.subject || "Ticket",
      } as any)
      .select()
      .single();

    if (error) throw error;
    return newConv as unknown as Conversation;
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

    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profil non trouvé");

    // Déterminer le rôle de l'expéditeur parmi 3 participants possibles
    const { data: conversation } = await this.supabase
      .from("conversations")
      .select("owner_profile_id, tenant_profile_id, provider_profile_id")
      .eq("id", data.conversation_id)
      .single() as { data: { owner_profile_id: string | null; tenant_profile_id: string | null; provider_profile_id: string | null } | null };

    if (!conversation) throw new Error("Conversation non trouvée");

    let senderRole: SenderRole;
    if (profile.id === conversation.owner_profile_id) {
      senderRole = "owner";
    } else if (profile.id === conversation.tenant_profile_id) {
      senderRole = "tenant";
    } else if (profile.id === conversation.provider_profile_id) {
      senderRole = "provider";
    } else {
      throw new Error("Utilisateur non participant à cette conversation");
    }

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

    // Envoyer une notification au destinataire (fire-and-forget)
    this.notifyRecipient(data.conversation_id, data.content).catch((err) =>
      console.warn("[ChatService] Notification failed:", err)
    );

    return {
      ...message,
      sender_name: `${message.sender?.prenom || ""} ${message.sender?.nom || ""}`.trim(),
      sender_avatar: message.sender?.avatar_url,
    } as Message;
  }

  /**
   * Notifier le destinataire d'un nouveau message via l'API
   */
  private async notifyRecipient(conversationId: string, messageContent: string): Promise<void> {
    await fetch("/api/messages/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, messageContent }),
    });
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
    onMessage: (message: Message) => void,
    onMessageUpdate?: (message: Message) => void
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
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            if (!onMessageUpdate) return;
            try {
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

              onMessageUpdate(message);
            } catch (err) {
              console.error("Erreur enrichissement message update:", err);
              onMessageUpdate(payload.new as Message);
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
   * Modifier un message (seul l'auteur peut modifier)
   */
  async editMessage(messageId: string, newContent: string): Promise<Message> {
    const { data, error } = await this.supabase
      .from("messages")
      .update({ content: newContent, edited_at: new Date().toISOString() } as any)
      .eq("id", messageId)
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
      ...data,
      sender_name: `${data.sender?.prenom || ""} ${data.sender?.nom || ""}`.trim(),
      sender_avatar: data.sender?.avatar_url,
    } as Message;
  }

  /**
   * Supprimer un message (soft delete)
   */
  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await this.supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", messageId);

    if (error) throw error;
  }

  /**
   * Clôturer une conversation
   */
  async closeConversation(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from("conversations")
      .update({ status: "closed" })
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

    // Tenter une URL signée (bucket privé) avec fallback sur URL publique
    const { data: signedData } = await this.supabase.storage
      .from("documents")
      .createSignedUrl(data.path, 60 * 60 * 24 * 7); // 7 jours

    const url = signedData?.signedUrl
      || this.supabase.storage.from("documents").getPublicUrl(data.path).data.publicUrl;

    return {
      url,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  }

  /**
   * Générer une URL signée pour un attachment existant
   */
  async getSignedAttachmentUrl(storagePath: string): Promise<string | null> {
    const { data, error } = await this.supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 3600); // 1h
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
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
      .select("owner_unread_count, tenant_unread_count, provider_unread_count, owner_profile_id, tenant_profile_id, provider_profile_id")
      .or(`owner_profile_id.eq.${profile.id},tenant_profile_id.eq.${profile.id},provider_profile_id.eq.${profile.id}`);

    if (!conversations) return 0;

    return (conversations as any[]).reduce((total, conv) => {
      if (conv.owner_profile_id === profile.id) return total + (conv.owner_unread_count ?? 0);
      if (conv.tenant_profile_id === profile.id) return total + (conv.tenant_unread_count ?? 0);
      if (conv.provider_profile_id === profile.id) return total + (conv.provider_unread_count ?? 0);
      return total;
    }, 0);
  }
}

export const chatService = new ChatService();

