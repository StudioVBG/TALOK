export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/inspections/[iid]/close - Clôturer un EDL
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ iid: string }> }
) {
  try {
    const { iid } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est propriétaire
    const { data: edl } = await supabase
      .from("edl")
      .select(`
        id,
        status,
        property:properties!inner(owner_id)
      `)
      // @ts-ignore - Supabase typing issue
      .eq("id", iid as any)
      .single();

    if (!edl) {
      return NextResponse.json(
        { error: "EDL non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    const edlData = edl as any;
    if (edlData.property.owner_id !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    if (edlData.status === "closed") {
      return NextResponse.json(
        { error: "L'EDL est déjà clôturé" },
        { status: 400 }
      );
    }

    // Vérifier que toutes les signatures sont présentes
    const { data: signatures } = await supabase
      .from("edl_signatures")
      .select("id")
      // @ts-ignore - Supabase typing issue
      .eq("edl_id", iid as any);

    if (!signatures || signatures.length === 0) {
      return NextResponse.json(
        { error: "L'EDL doit être signé avant clôture" },
        { status: 400 }
      );
    }

    // Clôturer l'EDL
    const { data: updated, error } = await supabase
      .from("edl")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      } as any)
      .eq("id", iid as any)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Inspection.Closed",
      payload: {
        edl_id: iid,
        closed_at: (updated as any)?.closed_at,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "edl_closed",
      entity_type: "edl",
      entity_id: iid,
    } as any);

    return NextResponse.json({ edl: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

