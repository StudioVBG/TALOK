export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/minutes/[minuteId]/sign
 * POST — Signe un PV (par président, secrétaire ou scrutateur)
 *
 * Quand les 2 signatures principales (président + secrétaire) sont posées,
 * le statut du PV passe automatiquement à 'signed'.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import { SignMinuteSchema } from "@/lib/validations/syndic";

interface RouteParams {
  params: { minuteId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    const parseResult = SignMinuteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    const supabaseAdminClient = (await import("@/app/api/_lib/supabase")).supabaseAdmin();
    const { data: minute, error: minuteError } = await supabaseAdminClient
      .from("copro_minutes")
      .select("*")
      .eq("id", params.minuteId)
      .maybeSingle();

    if (minuteError || !minute) {
      return NextResponse.json({ error: "PV introuvable" }, { status: 404 });
    }

    const auth = await requireSyndic(request, { siteId: (minute as any).site_id });
    if (auth instanceof NextResponse) return auth;

    // Ne pas re-signer un PV déjà signé/distribué/archivé
    if (["signed", "distributed", "archived"].includes((minute as any).status)) {
      return NextResponse.json(
        { error: `Ce PV est déjà en statut '${(minute as any).status}'` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const profileId = input.profile_id || auth.profile.id;

    const updates: Record<string, any> = { updated_at: now };

    if (input.role === "president") {
      updates.signed_by_president_at = now;
      updates.signed_by_president_profile_id = profileId;
    } else if (input.role === "secretary") {
      updates.signed_by_secretary_at = now;
      updates.signed_by_secretary_profile_id = profileId;
    } else if (input.role === "scrutineer") {
      const existing = ((minute as any).scrutineers_signatures as any[]) || [];
      existing.push({
        profile_id: profileId,
        signed_at: now,
        signature_url: input.signature_url || null,
      });
      updates.scrutineers_signatures = existing;
    }

    // Check si le PV passe en 'signed' (président + secrétaire signés)
    const presidentSigned = updates.signed_by_president_at || (minute as any).signed_by_president_at;
    const secretarySigned = updates.signed_by_secretary_at || (minute as any).signed_by_secretary_at;
    if (presidentSigned && secretarySigned && (minute as any).status === "draft") {
      updates.status = "signed";
    } else if (presidentSigned && secretarySigned && (minute as any).status === "reviewed") {
      updates.status = "signed";
    }

    const { data: updated, error: updateError } = await auth.serviceClient
      .from("copro_minutes")
      .update(updates)
      .eq("id", (minute as any).id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, minute: updated });
  } catch (error) {
    console.error("[minute:sign]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
