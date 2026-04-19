import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyMessageReceived } from "@/lib/services/notification-service";

/**
 * POST /api/messages/notify
 *
 * Appelée en fire-and-forget par `chatService.sendMessage` après un INSERT
 * réussi sur `messages`. Détermine le destinataire parmi les 3 participants
 * possibles (owner / tenant / provider) et délègue la création de la
 * notification (in-app + push + email) à `notifyMessageReceived`.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, messageContent } = body;

    if (!conversationId || !messageContent) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("id, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!senderProfile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("owner_profile_id, tenant_profile_id, provider_profile_id, conversation_type")
      .eq("id", conversationId)
      .single() as { data: {
        owner_profile_id: string | null;
        tenant_profile_id: string | null;
        provider_profile_id: string | null;
        conversation_type: string | null;
      } | null };

    if (!conversation) {
      return NextResponse.json({ error: "Conversation non trouvée" }, { status: 404 });
    }

    // Déterminer le destinataire parmi les 3 participants selon qui envoie.
    // Chaque conversation_type a exactement 2 participants non-null, donc
    // "l'autre" est toujours univoque.
    let recipientId: string | null = null;
    let recipientRole: "owner" | "tenant" | "provider" | null = null;

    if (senderProfile.id === conversation.owner_profile_id) {
      if (conversation.tenant_profile_id) {
        recipientId = conversation.tenant_profile_id;
        recipientRole = "tenant";
      } else if (conversation.provider_profile_id) {
        recipientId = conversation.provider_profile_id;
        recipientRole = "provider";
      }
    } else if (senderProfile.id === conversation.tenant_profile_id) {
      if (conversation.owner_profile_id) {
        recipientId = conversation.owner_profile_id;
        recipientRole = "owner";
      } else if (conversation.provider_profile_id) {
        recipientId = conversation.provider_profile_id;
        recipientRole = "provider";
      }
    } else if (senderProfile.id === conversation.provider_profile_id) {
      if (conversation.owner_profile_id) {
        recipientId = conversation.owner_profile_id;
        recipientRole = "owner";
      } else if (conversation.tenant_profile_id) {
        recipientId = conversation.tenant_profile_id;
        recipientRole = "tenant";
      }
    }

    if (!recipientId || !recipientRole) {
      return NextResponse.json({ error: "Destinataire non trouvé" }, { status: 404 });
    }

    const senderName = `${senderProfile.prenom || ""} ${senderProfile.nom || ""}`.trim() || "Utilisateur";

    await notifyMessageReceived(
      recipientId,
      senderName,
      messageContent,
      conversationId,
      recipientRole,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur notification message:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
