export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/notifications/settings - Récupérer les paramètres de notifications
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: settings, error } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", user.id as any);

    if (error) throw error;

    return NextResponse.json({ settings: settings || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/settings - Mettre à jour les paramètres
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { channel, category, enabled } = body;

    if (!channel || !category || enabled === undefined) {
      return NextResponse.json(
        { error: "channel, category et enabled requis" },
        { status: 400 }
      );
    }

    // Upsert le paramètre
    const { data: setting, error } = await supabase
      .from("notification_settings")
      .upsert(
        {
          user_id: user.id as any,
          channel,
          category,
          enabled,
        } as any,
        {
          onConflict: "user_id,channel,category",
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ setting });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

