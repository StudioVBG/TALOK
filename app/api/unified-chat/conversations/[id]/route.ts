export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour une conversation spécifique
 * GET /api/unified-chat/conversations/[id] - Détails d'une conversation
 * PATCH /api/unified-chat/conversations/[id] - Modifier une conversation
 * DELETE /api/unified-chat/conversations/[id] - Archiver/Quitter une conversation
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/unified-chat/conversations/[id]
 * Récupère les détails d'une conversation
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

    // Récupérer la conversation
    const { data: conversation, error: convError } = await supabase
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
          last_read_at,
          muted_until,
          joined_at,
          profiles:profiles (
            id,
            prenom,
            nom,
            avatar_url,
            role
          )
        ),
        property:properties (
          id,
          adresse_complete,
          ville
        )
      `
      )
      .eq("id", conversationId)
      .single();

    if (convError) {
      if (convError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Conversation non trouvée" },
          { status: 404 }
        );
      }
      throw convError;
    }

    // Vérifier que l'utilisateur est participant
    const participants = (conversation.conversation_participants || []) as Array<{
      profile_id: string;
      left_at?: string | null;
    }>;
    
    const isParticipant = participants.some(
      (p) => p.profile_id === profile.id && !p.left_at
    );

    if (!isParticipant && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Accès non autorisé à cette conversation" },
        { status: 403 }
      );
    }

    // Marquer comme lu
    await supabase.rpc("mark_conversation_as_read", {
      p_conversation_id: conversationId,
      p_profile_id: profile.id,
    });

    return NextResponse.json({ conversation });
  } catch (error: unknown) {
    console.error("Erreur API conversation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/unified-chat/conversations/[id]
 * Modifier une conversation (sujet, statut, etc.)
 */
export async function PATCH(
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
    const body = await request.json();

    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier que l'utilisateur est admin de la conversation
    const { data: participant, error: partError } = await supabase
      .from("conversation_participants")
      .select("is_admin")
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

    // Construire les champs à mettre à jour
    const updateData: Record<string, unknown> = {};

    if (body.subject !== undefined) {
      updateData.subject = body.subject;
    }

    if (body.status && participant.is_admin) {
      if (!["active", "archived", "closed"].includes(body.status)) {
        return NextResponse.json(
          { error: "Statut invalide" },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Aucune modification fournie" },
        { status: 400 }
      );
    }

    // Mettre à jour
    const { data: updatedConversation, error: updateError } = await supabase
      .from("unified_conversations")
      .update(updateData)
      .eq("id", conversationId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      conversation: updatedConversation,
      message: "Conversation mise à jour",
    });
  } catch (error: unknown) {
    console.error("Erreur API modification conversation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/unified-chat/conversations/[id]
 * Quitter une conversation (ou archiver si admin)
 */
export async function DELETE(
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

    // Vérifier le type d'action (query param: action=leave ou action=archive)
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "leave";

    if (action === "leave") {
      // Quitter la conversation
      const { error } = await supabase
        .from("conversation_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("profile_id", profile.id);

      if (error) throw error;

      return NextResponse.json({ message: "Vous avez quitté la conversation" });
    } else if (action === "archive") {
      // Vérifier si admin
      const { data: participant } = await supabase
        .from("conversation_participants")
        .select("is_admin")
        .eq("conversation_id", conversationId)
        .eq("profile_id", profile.id)
        .single();

      if (!participant?.is_admin) {
        return NextResponse.json(
          { error: "Seul un admin peut archiver la conversation" },
          { status: 403 }
        );
      }

      // Archiver
      const { error } = await supabase
        .from("unified_conversations")
        .update({ status: "archived" })
        .eq("id", conversationId);

      if (error) throw error;

      return NextResponse.json({ message: "Conversation archivée" });
    }

    return NextResponse.json(
      { error: "Action invalide (leave ou archive)" },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("Erreur API suppression conversation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

