/**
 * Service de Chat unifié - Supporte tous les rôles
 * Permet la communication entre propriétaires, locataires, colocataires,
 * prestataires, syndics et administrateurs
 */

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// =====================================================
// TYPES
// =====================================================

export type ConversationType =
  | "owner_tenant" // Propriétaire ↔ Locataire
  | "owner_provider" // Propriétaire ↔ Prestataire
  | "owner_syndic" // Propriétaire ↔ Syndic
  | "tenant_provider" // Locataire ↔ Prestataire (pour tickets)
  | "roommates" // Entre colocataires
  | "syndic_owners" // Syndic ↔ Groupe de propriétaires
  | "group" // Discussion de groupe
  | "ticket" // Liée à un ticket
  | "announcement"; // Annonces

export type ParticipantRole =
  | "owner"
  | "tenant"
  | "roommate"
  | "provider"
  | "syndic"
  | "admin"
  | "guarantor";

export type ContentType = "text" | "image" | "file" | "system" | "action";

export interface Conversation {
  id: string;
  type: ConversationType;
  property_id?: string | null;
  lease_id?: string | null;
  ticket_id?: string | null;
  copro_site_id?: string | null;
  subject?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  status: "active" | "archived" | "closed";
  created_at: string;
  updated_at: string;
  // Données jointes
  participants?: Participant[];
  my_unread_count?: number;
  // Données enrichies
  property_address?: string;
  other_participant_name?: string;
  other_participant_avatar?: string;
}

export interface Participant {
  id: string;
  conversation_id: string;
  profile_id: string;
  participant_role: ParticipantRole;
  can_write: boolean;
  is_admin: boolean;
  unread_count: number;
  last_read_at?: string | null;
  muted_until?: string | null;
  joined_at: string;
  left_at?: string | null;
  // Données jointes
  profile_name?: string;
  profile_avatar?: string | null;
  profile_prenom?: string;
  profile_nom?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  content: string;
  content_type: ContentType;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  // Données jointes
  sender_name?: string;
  sender_avatar?: string | null;
  sender_role?: ParticipantRole;
}

export interface CreateConversationData {
  type: ConversationType;
  participant_profile_ids: string[];
  participant_roles: ParticipantRole[];
  property_id?: string;
  lease_id?: string;
  ticket_id?: string;
  copro_site_id?: string;
  subject?: string;
  initial_message?: string;
}

export interface SendMessageOptions {
  contentType?: ContentType;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  metadata?: Record<string, unknown>;
}

// =====================================================
// SERVICE
// =====================================================

class UnifiedChatService {
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
  private profileCache: { id: string; role: string } | null = null;

  /**
   * Récupère le profil de l'utilisateur courant (avec cache)
   */
  private async getCurrentProfile(): Promise<{ id: string; role: string }> {
    if (this.profileCache) return this.profileCache;

    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const { data: profile, error } = await this.supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (error || !profile) throw new Error("Profil non trouvé");

    this.profileCache = profile;
    return profile;
  }

  /**
   * Réinitialise le cache du profil (à appeler lors de la déconnexion)
   */
  clearProfileCache(): void {
    this.profileCache = null;
  }

  /**
   * Récupérer toutes les conversations de l'utilisateur
   */
  async getConversations(type?: ConversationType): Promise<Conversation[]> {
    const profile = await this.getCurrentProfile();

    let query = this.supabase
      .from("unified_conversations")
      .select(
        `
        *,
        conversation_participants!inner (
          profile_id,
          participant_role,
          unread_count,
          can_write,
          is_admin,
          profiles:profiles (
            id,
            prenom,
            nom,
            avatar_url
          )
        ),
        property:properties (
          adresse_complete,
          ville
        )
      `
      )
      .eq("status", "active")
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filtrer et enrichir les conversations où l'utilisateur est participant
    return (data || [])
      .filter((conv: Record<string, unknown>) => {
        const participants = conv.conversation_participants as Array<{
          profile_id: string;
          left_at?: string | null;
        }>;
        return participants.some(
          (p) => p.profile_id === profile.id && !p.left_at
        );
      })
      .map((conv: Record<string, unknown>) => {
        const participants = conv.conversation_participants as Array<{
          profile_id: string;
          participant_role: ParticipantRole;
          unread_count: number;
          can_write: boolean;
          is_admin: boolean;
          profiles?: {
            id: string;
            prenom?: string;
            nom?: string;
            avatar_url?: string | null;
          };
        }>;

        const myParticipant = participants.find(
          (p) => p.profile_id === profile.id
        );
        const otherParticipants = participants.filter(
          (p) => p.profile_id !== profile.id
        );
        const otherParticipant = otherParticipants[0];

        const property = conv.property as {
          adresse_complete?: string;
          ville?: string;
        } | null;

        return {
          ...(conv as Conversation),
          my_unread_count: myParticipant?.unread_count || 0,
          participants: participants.map((p) => ({
            ...p,
            profile_name: `${p.profiles?.prenom || ""} ${p.profiles?.nom || ""}`.trim(),
            profile_avatar: p.profiles?.avatar_url,
            profile_prenom: p.profiles?.prenom,
            profile_nom: p.profiles?.nom,
          })),
          property_address: property
            ? `${property.adresse_complete || ""}, ${property.ville || ""}`.trim()
            : undefined,
          other_participant_name: otherParticipant
            ? `${otherParticipant.profiles?.prenom || ""} ${otherParticipant.profiles?.nom || ""}`.trim()
            : otherParticipants.length > 1
              ? `${otherParticipants.length} participants`
              : undefined,
          other_participant_avatar: otherParticipant?.profiles?.avatar_url,
        };
      });
  }

  /**
   * Récupérer une conversation par ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const profile = await this.getCurrentProfile();

    const { data, error } = await this.supabase
      .from("unified_conversations")
      .select(
        `
        *,
        conversation_participants (
          profile_id,
          participant_role,
          unread_count,
          can_write,
          is_admin,
          left_at,
          profiles:profiles (
            id,
            prenom,
            nom,
            avatar_url
          )
        ),
        property:properties (
          adresse_complete,
          ville
        )
      `
      )
      .eq("id", conversationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    const participants = (data.conversation_participants || []) as Array<{
      profile_id: string;
      participant_role: ParticipantRole;
      unread_count: number;
      can_write: boolean;
      is_admin: boolean;
      left_at?: string | null;
      profiles?: {
        id: string;
        prenom?: string;
        nom?: string;
        avatar_url?: string | null;
      };
    }>;

    const myParticipant = participants.find(
      (p) => p.profile_id === profile.id && !p.left_at
    );

    if (!myParticipant && profile.role !== "admin") {
      throw new Error("Accès non autorisé à cette conversation");
    }

    const otherParticipants = participants.filter(
      (p) => p.profile_id !== profile.id && !p.left_at
    );
    const otherParticipant = otherParticipants[0];
    const property = data.property as {
      adresse_complete?: string;
      ville?: string;
    } | null;

    return {
      ...data,
      my_unread_count: myParticipant?.unread_count || 0,
      participants: participants
        .filter((p) => !p.left_at)
        .map((p) => ({
          ...p,
          profile_name: `${p.profiles?.prenom || ""} ${p.profiles?.nom || ""}`.trim(),
          profile_avatar: p.profiles?.avatar_url,
          profile_prenom: p.profiles?.prenom,
          profile_nom: p.profiles?.nom,
        })),
      property_address: property
        ? `${property.adresse_complete || ""}, ${property.ville || ""}`.trim()
        : undefined,
      other_participant_name: otherParticipant
        ? `${otherParticipant.profiles?.prenom || ""} ${otherParticipant.profiles?.nom || ""}`.trim()
        : otherParticipants.length > 1
          ? `${otherParticipants.length} participants`
          : undefined,
      other_participant_avatar: otherParticipant?.profiles?.avatar_url,
    } as Conversation;
  }

  /**
   * Créer une conversation avec plusieurs participants
   */
  async createConversation(data: CreateConversationData): Promise<Conversation> {
    const profile = await this.getCurrentProfile();

    // Créer la conversation
    const { data: conversation, error: convError } = await this.supabase
      .from("unified_conversations")
      .insert({
        type: data.type,
        property_id: data.property_id || null,
        lease_id: data.lease_id || null,
        ticket_id: data.ticket_id || null,
        copro_site_id: data.copro_site_id || null,
        subject: data.subject || null,
      })
      .select()
      .single();

    if (convError) throw convError;

    // Préparer les participants
    const participants: Array<{
      conversation_id: string;
      profile_id: string;
      participant_role: ParticipantRole;
      is_admin: boolean;
    }> = [];

    // Ajouter les participants spécifiés
    for (let i = 0; i < data.participant_profile_ids.length; i++) {
      participants.push({
        conversation_id: conversation.id,
        profile_id: data.participant_profile_ids[i],
        participant_role: data.participant_roles[i],
        is_admin: data.participant_profile_ids[i] === profile.id,
      });
    }

    // S'assurer que le créateur est ajouté
    if (!data.participant_profile_ids.includes(profile.id)) {
      participants.push({
        conversation_id: conversation.id,
        profile_id: profile.id,
        participant_role: profile.role as ParticipantRole,
        is_admin: true,
      });
    }

    const { error: partError } = await this.supabase
      .from("conversation_participants")
      .insert(participants);

    if (partError) throw partError;

    // Envoyer le message initial si fourni
    if (data.initial_message) {
      await this.sendMessage(conversation.id, data.initial_message);
    }

    // Retourner la conversation complète
    const result = await this.getConversation(conversation.id);
    if (!result) throw new Error("Erreur lors de la création de la conversation");
    return result;
  }

  /**
   * Trouver ou créer une conversation entre deux profils
   */
  async getOrCreateDirectConversation(
    otherProfileId: string,
    otherRole: ParticipantRole,
    options?: {
      type?: ConversationType;
      propertyId?: string;
      leaseId?: string;
      subject?: string;
    }
  ): Promise<Conversation> {
    const profile = await this.getCurrentProfile();

    // Déterminer le type de conversation
    const type =
      options?.type ||
      this.determineConversationType(
        profile.role as ParticipantRole,
        otherRole
      );

    // Chercher une conversation existante
    const { data: existingConvs } = await this.supabase
      .from("unified_conversations")
      .select(
        `
        id,
        conversation_participants!inner (
          profile_id
        )
      `
      )
      .eq("type", type)
      .eq("status", "active");

    // Filtrer pour trouver une conversation avec exactement ces deux participants
    const existingConv = existingConvs?.find((conv: Record<string, unknown>) => {
      const participants = conv.conversation_participants as Array<{
        profile_id: string;
      }>;
      const profileIds = participants.map((p) => p.profile_id);
      return (
        profileIds.length === 2 &&
        profileIds.includes(profile.id) &&
        profileIds.includes(otherProfileId)
      );
    });

    if (existingConv) {
      const result = await this.getConversation(existingConv.id);
      if (result) return result;
    }

    // Créer une nouvelle conversation
    return this.createConversation({
      type,
      participant_profile_ids: [profile.id, otherProfileId],
      participant_roles: [profile.role as ParticipantRole, otherRole],
      property_id: options?.propertyId,
      lease_id: options?.leaseId,
      subject: options?.subject,
    });
  }

  /**
   * Déterminer le type de conversation en fonction des rôles
   */
  private determineConversationType(
    role1: ParticipantRole,
    role2: ParticipantRole
  ): ConversationType {
    const roles = [role1, role2].sort();

    if (roles.includes("owner") && roles.includes("tenant"))
      return "owner_tenant";
    if (roles.includes("owner") && roles.includes("provider"))
      return "owner_provider";
    if (roles.includes("owner") && roles.includes("syndic"))
      return "owner_syndic";
    if (roles.includes("tenant") && roles.includes("provider"))
      return "tenant_provider";
    if (
      roles.includes("roommate") ||
      (roles[0] === "tenant" && roles[1] === "tenant")
    )
      return "roommates";

    return "group";
  }

  /**
   * Récupérer les messages d'une conversation
   */
  async getMessages(
    conversationId: string,
    limit = 50,
    before?: string
  ): Promise<Message[]> {
    let query = this.supabase
      .from("unified_messages")
      .select(
        `
        *,
        sender:profiles!unified_messages_sender_profile_id_fkey (
          id,
          prenom,
          nom,
          avatar_url
        )
      `
      )
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Récupérer les rôles des participants
    const { data: participants } = await this.supabase
      .from("conversation_participants")
      .select("profile_id, participant_role")
      .eq("conversation_id", conversationId);

    const roleMap = new Map(
      (participants || []).map((p: { profile_id: string; participant_role: ParticipantRole }) => [
        p.profile_id,
        p.participant_role,
      ])
    );

    return (data || []).reverse().map((msg: Record<string, unknown>) => {
      const sender = msg.sender as {
        id: string;
        prenom?: string;
        nom?: string;
        avatar_url?: string | null;
      } | null;

      return {
        ...msg,
        sender_name: sender
          ? `${sender.prenom || ""} ${sender.nom || ""}`.trim()
          : "Utilisateur supprimé",
        sender_avatar: sender?.avatar_url,
        sender_role: roleMap.get(msg.sender_profile_id as string),
      } as Message;
    });
  }

  /**
   * Envoyer un message
   */
  async sendMessage(
    conversationId: string,
    content: string,
    options?: SendMessageOptions
  ): Promise<Message> {
    const profile = await this.getCurrentProfile();

    const { data: message, error } = await this.supabase
      .from("unified_messages")
      .insert({
        conversation_id: conversationId,
        sender_profile_id: profile.id,
        content,
        content_type: options?.contentType || "text",
        attachment_url: options?.attachmentUrl || null,
        attachment_name: options?.attachmentName || null,
        attachment_type: options?.attachmentType || null,
        attachment_size: options?.attachmentSize || null,
        metadata: options?.metadata || {},
      })
      .select(
        `
        *,
        sender:profiles!unified_messages_sender_profile_id_fkey (
          id,
          prenom,
          nom,
          avatar_url
        )
      `
      )
      .single();

    if (error) throw error;

    const sender = message.sender as {
      id: string;
      prenom?: string;
      nom?: string;
      avatar_url?: string | null;
    } | null;

    return {
      ...message,
      sender_name: sender
        ? `${sender.prenom || ""} ${sender.nom || ""}`.trim()
        : "",
      sender_avatar: sender?.avatar_url,
    } as Message;
  }

  /**
   * Marquer la conversation comme lue
   */
  async markAsRead(conversationId: string): Promise<void> {
    const profile = await this.getCurrentProfile();

    await this.supabase.rpc("mark_conversation_as_read", {
      p_conversation_id: conversationId,
      p_profile_id: profile.id,
    });
  }

  /**
   * Archiver une conversation
   */
  async archiveConversation(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from("unified_conversations")
      .update({ status: "archived" })
      .eq("id", conversationId);

    if (error) throw error;
  }

  /**
   * Quitter une conversation
   */
  async leaveConversation(conversationId: string): Promise<void> {
    const profile = await this.getCurrentProfile();

    const { error } = await this.supabase
      .from("conversation_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("profile_id", profile.id);

    if (error) throw error;
  }

  /**
   * Ajouter un participant à une conversation
   */
  async addParticipant(
    conversationId: string,
    profileId: string,
    role: ParticipantRole
  ): Promise<void> {
    const { error } = await this.supabase
      .from("conversation_participants")
      .insert({
        conversation_id: conversationId,
        profile_id: profileId,
        participant_role: role,
      });

    if (error) throw error;

    // Envoyer un message système
    await this.sendMessage(conversationId, `Un nouveau participant a rejoint la conversation`, {
      contentType: "system",
    });
  }

  /**
   * Obtenir le nombre total de messages non lus
   */
  async getTotalUnreadCount(): Promise<number> {
    try {
      const profile = await this.getCurrentProfile();

      const { data, error } = await this.supabase.rpc("get_total_unread_count", {
        p_profile_id: profile.id,
      });

      if (error) throw error;
      return data || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Uploader un fichier pour le chat
   */
  async uploadAttachment(
    conversationId: string,
    file: File
  ): Promise<{
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
   * Mettre en sourdine une conversation
   */
  async muteConversation(
    conversationId: string,
    untilDate: Date | null
  ): Promise<void> {
    const profile = await this.getCurrentProfile();

    const { error } = await this.supabase
      .from("conversation_participants")
      .update({
        muted_until: untilDate ? untilDate.toISOString() : null,
      })
      .eq("conversation_id", conversationId)
      .eq("profile_id", profile.id);

    if (error) throw error;
  }

  // =====================================================
  // REALTIME SUBSCRIPTIONS
  // =====================================================

  /**
   * Souscrire aux nouveaux messages (avec gestion d'erreur WebSocket)
   */
  subscribeToMessages(
    conversationId: string,
    onMessage: (message: Message) => void
  ): () => void {
    if (!this.realtimeEnabled) {
      console.warn("Realtime désactivé - les messages ne seront pas reçus en temps réel");
      return () => {};
    }

    const channelName = `unified_messages:${conversationId}`;

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
            table: "unified_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            try {
              const { data: sender } = await this.supabase
                .from("profiles")
                .select("id, prenom, nom, avatar_url")
                .eq("id", payload.new.sender_profile_id)
                .single();

              const message: Message = {
                ...(payload.new as Record<string, unknown>),
                sender_name: sender
                  ? `${sender.prenom || ""} ${sender.nom || ""}`.trim()
                  : "",
                sender_avatar: sender?.avatar_url,
              } as Message;

              onMessage(message);
            } catch (err) {
              console.error("Erreur enrichissement message:", err);
              onMessage(payload.new as Message);
            }
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
      console.error("Erreur lors de la souscription aux messages:", error);
      this.realtimeEnabled = false;
      return () => {};
    }
  }

  /**
   * Souscrire aux mises à jour des conversations
   */
  subscribeToConversations(
    onUpdate: (conversation: Partial<Conversation>) => void
  ): () => void {
    if (!this.realtimeEnabled) {
      console.warn("Realtime désactivé");
      return () => {};
    }

    const channelName = "unified_conversations:updates";

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
            table: "unified_conversations",
          },
          (payload) => {
            onUpdate(payload.new as Partial<Conversation>);
          }
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || err?.message?.includes("insecure")) {
            console.error("Erreur WebSocket:", err);
            this.realtimeEnabled = false;
          }
        });

      this.channels.set(channelName, channel);

      return () => {
        channel.unsubscribe();
        this.channels.delete(channelName);
      };
    } catch (error) {
      console.error("Erreur souscription conversations:", error);
      this.realtimeEnabled = false;
      return () => {};
    }
  }

  /**
   * Souscrire aux mises à jour du compteur de messages non lus
   */
  subscribeToUnreadCount(onUpdate: (count: number) => void): () => void {
    if (!this.realtimeEnabled) {
      return () => {};
    }

    const channelName = "unread_count:updates";

    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    try {
      const channel = this.supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversation_participants",
          },
          async () => {
            // Recalculer le total
            const count = await this.getTotalUnreadCount();
            onUpdate(count);
          }
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || err?.message?.includes("insecure")) {
            this.realtimeEnabled = false;
          }
        });

      this.channels.set(channelName, channel);

      return () => {
        channel.unsubscribe();
        this.channels.delete(channelName);
      };
    } catch {
      this.realtimeEnabled = false;
      return () => {};
    }
  }

  /**
   * Désabonner de tous les canaux
   */
  unsubscribeAll(): void {
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();
  }

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
}

// Export singleton
export const unifiedChatService = new UnifiedChatService();

