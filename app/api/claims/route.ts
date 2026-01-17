export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/claims - Déclarer un sinistre
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

    const body = await request.json();
    const { lease_id, description, incident_date, photos = [] } = body;

    if (!lease_id || !description || !incident_date) {
      return NextResponse.json(
        { error: "lease_id, description et incident_date requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est membre du bail
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", lease_id as any)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    if (!roommate) {
      return NextResponse.json(
        { error: "Vous n'êtes pas membre de ce bail" },
        { status: 403 }
      );
    }

    // Récupérer la police d'assurance
    const { data: policy } = await supabase
      .from("insurance_policies")
      .select("id")
      .eq("lease_id", lease_id as any)
      // @ts-ignore - Supabase typing issue
      .eq("status", "active")
      .maybeSingle();

    if (!policy) {
      return NextResponse.json(
        { error: "Aucune police d'assurance active trouvée" },
        { status: 404 }
      );
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    // Créer le sinistre
    const { data: claim, error } = await supabase
      .from("claims")
      .insert({
        insurance_policy_id: (policy as any)?.id,
        lease_id,
        tenant_id: (profile as any)?.id,
        description,
        incident_date,
        photos,
        status: "submitted",
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "insurance.claim.submitted",
      payload: {
        claim_id: (claim as any)?.id,
        lease_id,
        tenant_id: (profile as any)?.id,
      },
    } as any);

    return NextResponse.json({ claim });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

