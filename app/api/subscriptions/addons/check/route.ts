export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { checkLimit, type LimitResource } from "@/lib/subscriptions/check-limit";

const VALID_RESOURCES: LimitResource[] = ['signatures', 'storage', 'properties', 'users'];

/**
 * POST /api/subscriptions/addons/check
 * Body: { resource: LimitResource }
 *
 * Returns the current usage/limit for a resource, including add-on bonuses.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceRoleClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { resource } = await request.json() as { resource: string };

    if (!VALID_RESOURCES.includes(resource as LimitResource)) {
      return NextResponse.json({ error: "Ressource invalide" }, { status: 400 });
    }

    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: subscription } = await serviceSupabase
      .from("subscriptions")
      .select("plan_slug")
      .eq("owner_id", profile.id)
      .single();

    const planSlug = (subscription as any)?.plan_slug || "gratuit";

    const result = await checkLimit(
      serviceSupabase as any,
      profile.id,
      planSlug,
      resource as LimitResource
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[Addons Check]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
