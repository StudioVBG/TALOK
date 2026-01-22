export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour les messages d'une conversation
 * GET /api/unified-chat/conversations/[id]/messages - Liste des messages
 * POST /api/unified-chat/conversations/[id]/messages - Envoyer un message
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Schéma de validation pour l'envoi de message
const sendMessageSchema = z.object({
  content: z.string().min(1, "Le message ne peut pas être vide"),
  content_type: z.enum(["text", "image", "file", "system", "action"]).optional(),
  attachment_url: z.string().url().optional(),
  attachment_name: z.string().optional(),
  attachment_type: z.string().optional(),
  attachment_size: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /api/unified-chat/conversations/[id]/messages
 * Récupère les messages d'une conversation
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const conversationId = id;

    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier que l'utilisateur est participant
    const { data: participant, error: partError } = await supabase
      .from("conversation_participants")
      .select("profile_id, participant_role")
      .eq("conversation_id", conversationId)
      .eq("profile_id", profile.id)
      .is("left_at", null)
      .single();

    if (partError && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Vous n'êtes pas participant de cette conversation" },
        { status: 403 }
      );
    }

    // Récupérer les paramètres de pagination
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before"); // Cursor pour pagination

    // Récupérer les messages
    let query = supabase
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

    const { data: messages, error: msgError } = await query;

    if (msgError) {
      throw msgError;
    }

    // Récupérer les rôles des participants
    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("profile_id, participant_role")
      .eq("conversation_id", conversationId);

    const roleMap = new Map(
      (participants || []).map((p: { profile_id: string; participant_role: string }) => [
        p.profile_id,
        p.participant_role,
      ])
    );

    // Enrichir les messages
    const enrichedMessages = (messages || []).reverse().map((msg: Record<string, unknown>) => {
      const sender = msg.sender as {
        id: string;
        prenom?: string;
        nom?: string;
        avatar_url?: string | null;
      } | null;

      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_profile_id: msg.sender_profile_id,
        content: msg.content,
        content_type: msg.content_type,
        attachment_url: msg.attachment_url,
        attachment_name: msg.attachment_name,
        attachment_type: msg.attachment_type,
        attachment_size: msg.attachment_size,
        metadata: msg.metadata,
        created_at: msg.created_at,
        edited_at: msg.edited_at,
        sender_name: sender
          ? `${sender.prenom || ""} ${sender.nom || ""}`.trim()
          : "Utilisateur supprimé",
        sender_avatar: sender?.avatar_url,
        sender_role: roleMap.get(msg.sender_profile_id as string),
      };
    });

    // Marquer comme lu
    await supabase.rpc("mark_conversation_as_read", {
      p_conversation_id: conversationId,
      p_profile_id: profile.id,
    });

    return NextResponse.json({
      messages: enrichedMessages,
      has_more: messages?.length === limit,
    });
  } catch (error: unknown) {
    console.error("Erreur API messages:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/unified-chat/conversations/[id]/messages
 * Envoyer un message dans une conversation
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const conversationId = id;

    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier que l'utilisateur est participant et peut écrire
    const { data: participant, error: partError } = await supabase
      .from("conversation_participants")
      .select("profile_id, can_write, participant_role")
      .eq("conversation_id", conversationId)
      .eq("profile_id", profile.id)
      .is("left_at", null)
      .single();

    if (partError || !participant) {
      return NextResponse.json(
        { error: "Vous n'êtes pas participant de cette conversation" },
        { status: 403 }
      );
    }

    if (!participant.can_write) {
      return NextResponse.json(
        { error: "Vous n'avez pas le droit d'écrire dans cette conversation" },
        { status: 403 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validationResult = sendMessageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Créer le message
    const { data: message, error: msgError } = await supabase
      .from("unified_messages")
      .insert({
        conversation_id: conversationId,
        sender_profile_id: profile.id,
        content: data.content,
        content_type: data.content_type || "text",
        attachment_url: data.attachment_url || null,
        attachment_name: data.attachment_name || null,
        attachment_type: data.attachment_type || null,
        attachment_size: data.attachment_size || null,
        metadata: data.metadata || {},
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

    if (msgError) {
      throw msgError;
    }

    const sender = message.sender as {
      id: string;
      prenom?: string;
      nom?: string;
      avatar_url?: string | null;
    } | null;

    const enrichedMessage = {
      ...message,
      sender_name: sender
        ? `${sender.prenom || ""} ${sender.nom || ""}`.trim()
        : "",
      sender_avatar: sender?.avatar_url,
      sender_role: participant.participant_role,
    };

    return NextResponse.json({ message: enrichedMessage }, { status: 201 });
  } catch (error: unknown) {
    console.error("Erreur API envoi message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

