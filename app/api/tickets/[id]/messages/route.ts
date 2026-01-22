/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * GET /api/tickets/[id]/messages - Récupérer les messages d'un ticket
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const ticketId = id;

    // Vérifier l'accès au ticket
    const { data: ticket } = await supabaseClient
      .from("tickets")
      .select("id, lease_id, created_by_profile_id")
      .eq("id", ticketId as any)
      .single();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    const ticketData = ticket as any;

    // Vérifier les permissions
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    const isOwnerOrAdmin = profileData?.role === "owner" || profileData?.role === "admin";
    const isCreator = ticketData.created_by_profile_id === profileData?.id;

    // Vérifier si membre du bail
    let hasAccess = isOwnerOrAdmin || isCreator;
    if (ticketData.lease_id) {
      const { data: roommate } = await supabaseClient
        .from("roommates")
        .select("id")
        .eq("lease_id", ticketData.lease_id as any)
        .eq("user_id", user.id as any)
        .maybeSingle();
      hasAccess = hasAccess || !!roommate;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer les messages
    const { data: messages, error } = await supabaseClient
      .from("ticket_messages")
      .select(`
        *,
        sender:profiles!ticket_messages_sender_user_fkey(prenom, nom, avatar_url)
      `)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Filtrer les messages internes si l'utilisateur n'est pas owner/admin
    const filteredMessages = isOwnerOrAdmin
      ? messages
      : messages?.filter((m: any) => !m.is_internal);

    return NextResponse.json({ messages: filteredMessages });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tickets/[id]/messages - Envoyer un message dans un ticket
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const ticketId = id;
    const body = await request.json();
    const { body: messageBody, attachments = [], is_internal = false } = body;

    if (!messageBody) {
      return NextResponse.json(
        { error: "Message requis" },
        { status: 400 }
      );
    }

    // Vérifier l'accès au ticket (même logique que GET)
    const { data: ticket } = await supabaseClient
      .from("tickets")
      .select("id, lease_id, created_by_profile_id")
      .eq("id", ticketId as any)
      .single();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    const ticketDataPost = ticket as any;

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileDataPost = profile as any;
    const isOwnerOrAdmin = profileDataPost?.role === "owner" || profileDataPost?.role === "admin";
    const isCreator = ticketDataPost.created_by_profile_id === profileDataPost?.id;

    let hasAccess = isOwnerOrAdmin || isCreator;
    if (ticketDataPost.lease_id) {
      const { data: roommate } = await supabaseClient
        .from("roommates")
        .select("id")
        .eq("lease_id", ticketDataPost.lease_id as any)
        .eq("user_id", user.id as any)
        .maybeSingle();
      hasAccess = hasAccess || !!roommate;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Seuls owner/admin peuvent envoyer des messages internes
    if (is_internal && !isOwnerOrAdmin) {
      return NextResponse.json(
        { error: "Seuls les propriétaires et admins peuvent envoyer des messages internes" },
        { status: 403 }
      );
    }

    // Créer le message
    const { data: message, error } = await supabaseClient
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId as any,
        sender_user: user.id as any,
        body: messageBody,
        attachments,
        is_internal,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const messageData = message as any;

    // Émettre un événement
    await supabaseClient.from("outbox").insert({
      event_type: "ticket.message.created",
      payload: {
        ticket_id: ticketId,
        message_id: messageData.id,
        sender_user: user.id,
      },
    } as any);

    return NextResponse.json({ message: messageData });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





