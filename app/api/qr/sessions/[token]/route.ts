/**
 * GET /api/qr/sessions/[token]
 *
 * Lecture d'une session QR par son token. Utilisé par la page mobile
 * `/qr/scan/[token]` pour afficher le payload avant confirmation.
 *
 * Marque automatiquement la session comme 'scanned' (premier accès) afin
 * que le desktop reçoive un événement realtime indiquant que le QR a été lu.
 *
 * Sécurité :
 * - Token signé HMAC + lookup DB
 * - Auth requise (sauf kind=mobile_signin où le but EST l'auth)
 * - Si target_user_id défini, seul ce user peut scanner
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { verifyQRSessionToken } from "@/lib/qr/session-token";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  const tokenPayload = verifyQRSessionToken(token);
  if (!tokenPayload) {
    return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 400 });
  }

  const serviceClient = getServiceClient();
  const { data: session, error } = await (serviceClient
    .from("qr_sessions") as any)
    .select("*")
    .eq("id", tokenPayload.sessionId)
    .eq("token", token)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Session expirée", status: "expired" }, { status: 410 });
  }
  if (session.status === "expired" || session.status === "consumed") {
    return NextResponse.json({ error: "Session non utilisable", status: session.status }, { status: 410 });
  }

  // Auth check (sauf mobile_signin où l'objectif est de connecter)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (session.kind !== "mobile_signin") {
    if (!user) {
      return NextResponse.json({ error: "Non authentifié", needsAuth: true }, { status: 401 });
    }
    if (session.target_user_id && session.target_user_id !== user.id) {
      return NextResponse.json({ error: "Cette session ne vous est pas destinée" }, { status: 403 });
    }
  }

  // Marquer comme 'scanned' au premier accès (idempotent)
  if (session.status === "pending") {
    const ua = request.headers.get("user-agent") || null;
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    await (serviceClient.from("qr_sessions") as any)
      .update({
        status: "scanned",
        scanned_at: new Date().toISOString(),
        scanner_metadata: {
          user_agent: ua,
          ip,
          scanner_user_id: user?.id || null,
        },
      })
      .eq("id", session.id)
      .eq("status", "pending");
  }

  return NextResponse.json({
    sessionId: session.id,
    kind: session.kind,
    status: session.status === "pending" ? "scanned" : session.status,
    payload: session.payload,
    redirectUrl: session.redirect_url,
    expiresAt: session.expires_at,
  });
}
