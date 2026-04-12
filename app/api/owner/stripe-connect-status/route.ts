export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/owner/stripe-connect-status
 *
 * Endpoint minimal dédié au bandeau dashboard "Encaissement en ligne non
 * configuré" (StripeConnectBanner). On ne veut surtout PAS que le
 * composant lance deux requêtes directes Supabase (profiles +
 * stripe_connect_accounts) depuis le navigateur avec le client anon,
 * parce que toute récursion RLS 42P17 sur profiles faisait remonter
 * deux des quatre GET 500 observés côté dashboard owner.
 *
 * On fait donc la lecture côté serveur avec le service client, et on
 * retourne strictement ce dont le bandeau a besoin :
 *   - configured: false     → afficher le bandeau
 *   - configured: true      → ne rien afficher
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

interface StripeConnectStatusResponse {
  configured: boolean;
  charges_enabled: boolean;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || (profile as { role?: string }).role !== "owner") {
      // Non-owners don't see the banner — treat as "configured" so the
      // client hides it without raising an error.
      const payload: StripeConnectStatusResponse = {
        configured: true,
        charges_enabled: false,
      };
      return NextResponse.json(payload);
    }

    const profileId = (profile as { id: string }).id;

    const { data: connectAccount, error: connectError } = await serviceClient
      .from("stripe_connect_accounts")
      .select("id, charges_enabled")
      .eq("profile_id", profileId)
      .is("entity_id", null) // S2-2 : compte personnel de l'owner uniquement
      .maybeSingle();

    if (connectError) {
      console.error(
        "[GET /api/owner/stripe-connect-status] Erreur lecture compte:",
        connectError,
      );
      // On ne veut pas bloquer le dashboard sur ce bandeau cosmétique.
      const payload: StripeConnectStatusResponse = {
        configured: true,
        charges_enabled: false,
      };
      return NextResponse.json(payload);
    }

    const chargesEnabled =
      (connectAccount as { charges_enabled?: boolean } | null)
        ?.charges_enabled === true;
    const configured = !!connectAccount && chargesEnabled;

    const payload: StripeConnectStatusResponse = {
      configured,
      charges_enabled: chargesEnabled,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error: unknown) {
    console.error(
      "[GET /api/owner/stripe-connect-status] Erreur:",
      error,
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 },
    );
  }
}
