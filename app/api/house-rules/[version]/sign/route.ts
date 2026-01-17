export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractClientIP } from "@/lib/utils/ip-address";

/**
 * POST /api/house-rules/[version]/sign - Signer une version du règlement de colocation
 */
export async function POST(
  request: Request,
  { params }: { params: { version: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const versionId = params.version;

    // Récupérer la version du règlement
    const { data: ruleVersion, error: ruleError } = await supabase
      .from("house_rule_versions")
      .select("*, lease:leases(id)")
      .eq("id", versionId as any)
      .single();

    if (ruleError || !ruleVersion) {
      return NextResponse.json(
        { error: "Version du règlement non trouvée" },
        { status: 404 }
      );
    }

    const ruleData = ruleVersion as any;

    // Vérifier que l'utilisateur est membre du bail
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", ruleData.lease_id)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    if (!roommate) {
      return NextResponse.json(
        { error: "Vous n'êtes pas membre de ce bail" },
        { status: 403 }
      );
    }

    // Vérifier si déjà signé
    const { data: existing } = await supabase
      .from("rule_acceptances")
      .select("id")
      .eq("rule_version_id", versionId as any)
      .eq("roommate_id", (roommate as any)?.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Vous avez déjà signé ce règlement" },
        { status: 409 }
      );
    }

    // Récupérer IP et User Agent
    const ip = extractClientIP(request);
    const userAgent = request.headers.get("user-agent") || null;

    // Créer l'acceptation
    const { data: acceptance, error } = await supabase
      .from("rule_acceptances")
      .insert({
        rule_version_id: versionId,
        roommate_id: (roommate as any)?.id,
        ip_inet: ip,
        user_agent: userAgent,
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "sign",
      entity_type: "house_rule",
      entity_id: versionId,
      ip_inet: ip,
      user_agent: userAgent,
    } as any);

    return NextResponse.json({ acceptance });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

