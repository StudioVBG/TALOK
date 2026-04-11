export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

/**
 * POST /api/subscriptions/addons/consume-signature
 *
 * Consumes one signature from the oldest active pack (FIFO).
 * Called after a signature has been performed when the base plan quota is exhausted.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceRoleClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Use the SQL function for atomic FIFO consumption
    const { data: addonId, error } = await serviceSupabase
      .rpc("consume_addon_signature", { p_profile_id: profile.id });

    if (error) {
      throw error;
    }

    if (!addonId) {
      return NextResponse.json(
        { error: "Aucun pack de signatures disponible", consumed: false },
        { status: 404 }
      );
    }

    return NextResponse.json({ consumed: true, addonId });
  } catch (error: unknown) {
    console.error("[Addons Consume Signature]", error);
    return NextResponse.json(
      { error: extractErrorMessage(error) },
      { status: 500 }
    );
  }
}
