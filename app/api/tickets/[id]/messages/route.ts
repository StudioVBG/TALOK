/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
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
    const serviceClient = getTypedSupabaseClient(getServiceClient());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const ticketId = id;

    const { data: ticket } = await serviceClient
      .from("tickets")
      .select("id, lease_id, created_by_profile_id, owner_id, assigned_to")
      .eq("id", ticketId as any)
      .maybeSingle();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    const ticketData = ticket as any;

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .maybeSingle();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner =
      ticketData.owner_id === profileData?.id;
    const isOwnerOrAdmin = isOwner || isAdmin;
    const isCreator = ticketData.created_by_profile_id === profileData?.id;
    const isAssigned = ticketData.assigned_to === profileData?.id;

    let hasAccess = isOwnerOrAdmin || isCreator || isAssigned;
    if (!hasAccess && ticketData.lease_id) {
      const { data: roommate } = await serviceClient
        .from("roommates")
        .select("id")
        .eq("lease_id", ticketData.lease_id as any)
        .eq("user_id", user.id as any)
        .maybeSingle();
      hasAccess = !!roommate;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const { data: messages, error } = await serviceClient
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
    const serviceClient = getTypedSupabaseClient(getServiceClient());
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const { data: ticket } = await serviceClient
      .from("tickets")
      .select("id, lease_id, created_by_profile_id, owner_id, assigned_to")
      .eq("id", ticketId as any)
      .maybeSingle();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    const ticketDataPost = ticket as any;

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .maybeSingle();

    const profileDataPost = profile as any;
    const isAdmin = profileDataPost?.role === "admin";
    const isOwner = ticketDataPost.owner_id === profileDataPost?.id;
    const isOwnerOrAdmin = isOwner || isAdmin;
    const isCreator = ticketDataPost.created_by_profile_id === profileDataPost?.id;
    const isAssigned = ticketDataPost.assigned_to === profileDataPost?.id;

    let hasAccess = isOwnerOrAdmin || isCreator || isAssigned;
    if (!hasAccess && ticketDataPost.lease_id) {
      const { data: roommate } = await serviceClient
        .from("roommates")
        .select("id")
        .eq("lease_id", ticketDataPost.lease_id as any)
        .eq("user_id", user.id as any)
        .maybeSingle();
      hasAccess = !!roommate;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    if (is_internal && !isOwnerOrAdmin) {
      return NextResponse.json(
        { error: "Seuls les propriétaires et admins peuvent envoyer des messages internes" },
        { status: 403 }
      );
    }

    const { data: message, error } = await serviceClient
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

    await serviceClient.from("outbox").insert({
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





