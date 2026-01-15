export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/broadcast - Envoyer un message global (BTN-A10)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut envoyer un message global" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, message, audience, link } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "title et message requis" },
        { status: 400 }
      );
    }

    // Déterminer les destinataires selon l'audience
    let targetUsers: string[] = [];

    if (audience === "all") {
      // Tous les utilisateurs
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("user_id");
      targetUsers = allProfiles?.map((p: any) => p.user_id) || [];
    } else if (audience === "owners") {
      const { data: ownerProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        // @ts-ignore - Supabase typing issue
        .eq("role", "owner");
      targetUsers = ownerProfiles?.map((p: any) => p.user_id) || [];
    } else if (audience === "tenants") {
      const { data: tenantProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        // @ts-ignore - Supabase typing issue
        .eq("role", "tenant");
      targetUsers = tenantProfiles?.map((p: any) => p.user_id) || [];
    } else if (audience === "providers") {
      const { data: providerProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        // @ts-ignore - Supabase typing issue
        .eq("role", "provider");
      targetUsers = providerProfiles?.map((p: any) => p.user_id) || [];
    } else if (Array.isArray(audience)) {
      // Liste spécifique d'utilisateurs
      targetUsers = audience;
    }

    // Créer une notification pour chaque utilisateur
    const notifications = targetUsers.map((userId) => ({
      user_id: userId,
      type: "broadcast",
      title,
      body: message,
      link: link || null,
      is_read: false,
    }));

    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications as any);

      if (notifError) throw notifError;
    }

    // Émettre un événement pour chaque utilisateur
    for (const userId of targetUsers) {
      await supabase.from("outbox").insert({
        event_type: "Message.Sent",
        payload: {
          type: "broadcast",
          user_id: userId,
          title,
          message,
          link,
        },
      } as any);
    }

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "broadcast_sent",
      entity_type: "message",
      metadata: {
        title,
        audience,
        recipients_count: targetUsers.length,
      },
    } as any);

    return NextResponse.json({
      success: true,
      message: "Message envoyé",
      recipients_count: targetUsers.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

