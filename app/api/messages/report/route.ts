import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { messageId, conversationId, reason, details } = body;

    if (!messageId || !conversationId || !reason) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const validReasons = ["spam", "harassment", "inappropriate", "other"];
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: "Raison invalide" }, { status: 400 });
    }

    // Get reporter's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Get the message content for the moderation queue
    const { data: message } = await supabase
      .from("messages")
      .select("content, sender_profile_id")
      .eq("id", messageId)
      .single();

    if (!message) {
      return NextResponse.json({ error: "Message non trouvé" }, { status: 404 });
    }

    // Insert into moderation_queue
    const { error } = await supabase
      .from("moderation_queue")
      .insert({
        entity_type: "message",
        entity_id: messageId,
        flagged_content: message.content,
        priority: reason === "harassment" ? "high" : "medium",
        status: "pending",
        action_metadata: {
          reported_by: profile.id,
          reason,
          details: details || null,
          conversation_id: conversationId,
          reported_user_id: message.sender_profile_id,
        },
      });

    if (error) {
      console.error("Erreur insertion moderation_queue:", error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur signalement message:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
