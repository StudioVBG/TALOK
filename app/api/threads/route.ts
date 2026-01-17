export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * POST /api/threads - Créer un fil de discussion
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { context_type, context_id, title } = body; // context_type: 'property' | 'unit' | 'ticket' | 'lease'

    if (!context_type || !context_id || !title) {
      return NextResponse.json(
        { error: "context_type, context_id et title requis" },
        { status: 400 }
      );
    }

    // Vérifier l'accès selon le contexte
    let hasAccess = false;
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;

    switch (context_type) {
      case "property": {
        const { data: property } = await supabaseClient
          .from("properties")
          .select("owner_id")
          .eq("id", context_id as any)
          .single();
        const propertyData = property as any;
        hasAccess = propertyData?.owner_id === profileData?.id;
        break;
      }
      case "lease": {
        const { data: roommate } = await supabaseClient
          .from("roommates")
          .select("id")
          .eq("lease_id", context_id as any)
          .eq("user_id", user.id as any)
          .maybeSingle();
        hasAccess = !!roommate;
        break;
      }
      case "ticket": {
        const { data: ticket } = await supabaseClient
          .from("tickets")
          .select(`
            property:properties!inner(owner_id),
            lease:leases(roommates(user_id))
          `)
          .eq("id", context_id as any)
          .single();
        const ticketData = ticket as any;
        hasAccess = ticketData?.property?.owner_id === profileData?.id ||
          ticketData?.lease?.roommates?.some((r: any) => r.user_id === user.id);
        break;
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Créer le fil
    const { data: thread, error } = await supabaseClient
      .from("chat_threads")
      .insert({
        context_type,
        context_id,
        title,
        created_by: user.id as any,
      } as any)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ thread });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





