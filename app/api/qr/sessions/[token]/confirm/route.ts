/**
 * POST /api/qr/sessions/[token]/confirm
 *
 * Le mobile confirme l'action liée à la session QR. Cela passe le statut à
 * 'confirmed', ce qui via Supabase Realtime déclenche la redirection automatique
 * sur le desktop qui affichait le QR.
 *
 * Body optionnel : { extraPayload?: object }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { verifyQRSessionToken } from "@/lib/qr/session-token";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, "auth");
  if (rateLimitResponse) return rateLimitResponse;

  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  const tokenPayload = verifyQRSessionToken(token);
  if (!tokenPayload) {
    return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const serviceClient = getServiceClient();
  const { data: session, error: fetchError } = await (serviceClient
    .from("qr_sessions") as any)
    .select("*")
    .eq("id", tokenPayload.sessionId)
    .eq("token", token)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Session expirée" }, { status: 410 });
  }
  if (!["pending", "scanned"].includes(session.status)) {
    return NextResponse.json(
      { error: `Session déjà ${session.status}` },
      { status: 410 }
    );
  }
  if (session.target_user_id && session.target_user_id !== user.id) {
    return NextResponse.json({ error: "Session non destinée à cet utilisateur" }, { status: 403 });
  }

  let extraPayload: any = {};
  try {
    const body = await request.json();
    if (body && typeof body === "object" && body.extraPayload) {
      extraPayload = body.extraPayload;
    }
  } catch {
    // body optionnel
  }

  const mergedPayload = { ...(session.payload || {}), ...extraPayload };

  const { error: updateError } = await (serviceClient.from("qr_sessions") as any)
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      payload: mergedPayload,
      scanner_metadata: {
        ...(session.scanner_metadata || {}),
        confirmer_user_id: user.id,
      },
    })
    .eq("id", session.id)
    .in("status", ["pending", "scanned"]);

  if (updateError) {
    console.error("[qr/sessions/confirm] update error:", updateError);
    return NextResponse.json({ error: "Erreur lors de la confirmation" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    redirectUrl: session.redirect_url,
    sessionId: session.id,
  });
}
