import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyMessageReceived } from "@/lib/services/notification-service";

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

    // Récupérer le profil de l'expéditeur
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("id, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!senderProfile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer la conversation pour identifier le destinataire
    const { data: conversation } = await supabase
      .from("conversations")
      .select("owner_profile_id, tenant_profile_id")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation non trouvée" }, { status: 404 });
    }

    // Déterminer le destinataire (l'autre participant)
    const recipientId = senderProfile.id === conversation.owner_profile_id
      ? conversation.tenant_profile_id
      : conversation.owner_profile_id;

    const senderName = `${senderProfile.prenom || ""} ${senderProfile.nom || ""}`.trim() || "Utilisateur";

    // Déterminer le rôle du destinataire pour l'URL
    const recipientRole = recipientId === conversation.owner_profile_id ? "owner" : "tenant";

    await notifyMessageReceived(
      recipientId,
      senderName,
      messageContent,
      conversationId,
      recipientRole as "owner" | "tenant",
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur notification message:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
