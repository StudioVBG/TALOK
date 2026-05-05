/**
 * POST /api/qr/sessions/create
 *
 * Crée une session QR temporaire et renvoie le QR brandé Talok à afficher
 * sur le desktop. Le mobile scannera l'URL `/qr/scan/<token>` pour confirmer.
 *
 * Body :
 * {
 *   kind: 'mobile_signin' | 'key_handover' | 'document_signature' | 'lease_signature' | 'edl_signature' | '2fa_setup_companion',
 *   payload?: object,           // données métier propres au kind
 *   redirectUrl?: string,       // chemin relatif où rediriger une fois confirmé
 *   targetUserId?: string,      // si null : n'importe quel user authentifié peut scanner
 *   ttlSeconds?: number,        // défaut 600 (10 min), max 3600
 * }
 *
 * Réponse :
 * {
 *   sessionId, token, qrDataUrl, scanUrl, expiresAt, status
 * }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { generateBrandedQR } from "@/lib/qr/generator";
import { signQRSessionToken } from "@/lib/qr/session-token";

const ALLOWED_KINDS = new Set([
  "mobile_signin",
  "key_handover",
  "document_signature",
  "lease_signature",
  "edl_signature",
  "2fa_setup_companion",
]);

const DEFAULT_TTL_SECONDS = 600;
const MAX_TTL_SECONDS = 3600;

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, "api");
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { kind, payload = {}, redirectUrl, targetUserId, ttlSeconds = DEFAULT_TTL_SECONDS } = body || {};

  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json(
      { error: `kind invalide. Valeurs acceptées : ${Array.from(ALLOWED_KINDS).join(", ")}` },
      { status: 400 }
    );
  }

  const ttl = Math.min(Math.max(60, Number(ttlSeconds) || DEFAULT_TTL_SECONDS), MAX_TTL_SECONDS);
  const expiresAt = new Date(Date.now() + ttl * 1000);

  // redirect_url doit être un chemin relatif (anti-open-redirect)
  let safeRedirect: string | null = null;
  if (typeof redirectUrl === "string" && redirectUrl.length > 0) {
    if (!redirectUrl.startsWith("/") || redirectUrl.startsWith("//")) {
      return NextResponse.json(
        { error: "redirectUrl doit être un chemin relatif commençant par /" },
        { status: 400 }
      );
    }
    safeRedirect = redirectUrl;
  }

  const serviceClient = getServiceClient();

  // Insertion : on génère d'abord l'ID pour pouvoir signer le token
  const sessionId = crypto.randomUUID();
  const token = signQRSessionToken({
    sessionId,
    kind,
    expiresAt: expiresAt.toISOString(),
  });

  const { error: insertError } = await (serviceClient.from("qr_sessions") as any).insert({
    id: sessionId,
    token,
    kind,
    status: "pending",
    initiator_user_id: user.id,
    target_user_id: targetUserId || null,
    payload,
    redirect_url: safeRedirect,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    console.error("[qr/sessions/create] insert error:", insertError);
    return NextResponse.json({ error: "Erreur lors de la création de la session" }, { status: 500 });
  }

  // URL absolue pour le QR (le mobile l'ouvre)
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin ||
    "https://talok.fr";
  const scanUrl = `${origin}/qr/scan/${encodeURIComponent(token)}`;

  let qrDataUrl: string;
  try {
    qrDataUrl = await generateBrandedQR(scanUrl, { size: 320, withLogo: true });
  } catch (err) {
    console.error("[qr/sessions/create] QR gen error:", err);
    return NextResponse.json({ error: "Erreur génération QR" }, { status: 500 });
  }

  return NextResponse.json({
    sessionId,
    token,
    qrDataUrl,
    scanUrl,
    expiresAt: expiresAt.toISOString(),
    status: "pending",
  });
}
