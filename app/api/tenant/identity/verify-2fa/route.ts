export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { createHmac } from "crypto";

const OTP_SECRET = process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "identity-2fa-fallback";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";

function hashOtp(otpCode: string): string {
  return createHmac("sha256", OTP_SECRET).update(otpCode).digest("hex");
}

function buildRedirectUrl(leaseId: string | null): string {
  return leaseId
    ? `${BASE_URL}/tenant/identity/renew?lease_id=${leaseId}&verified_2fa=true`
    : `${BASE_URL}/tenant/identity`;
}

/**
 * GET /api/tenant/identity/verify-2fa?token=xxx&lease_id=yyy
 * Validation par lien email : marque la demande comme validée et redirige vers la page renew.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const leaseId = searchParams.get("lease_id");

    const redirectUrl = buildRedirectUrl(leaseId);

    if (!user) {
      return NextResponse.redirect(`${BASE_URL}/auth/login?redirect_to=${encodeURIComponent(request.url)}`);
    }
    if (!token) {
      return NextResponse.redirect(redirectUrl);
    }

    const serviceClient = getServiceClient();
    const { data: row, error: fetchError } = await serviceClient
      .from("identity_2fa_requests")
      .select("id, profile_id, lease_id, expires_at, verified_at")
      .eq("token", token)
      .single();

    if (fetchError || !row) {
      return NextResponse.redirect(redirectUrl);
    }

    const profileId = (row as { profile_id: string }).profile_id;
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("user_id")
      .eq("id", profileId)
      .single();
    if (!profile || (profile as { user_id: string }).user_id !== user.id) {
      return NextResponse.redirect(redirectUrl);
    }

    const rowLeaseId = (row as { lease_id: string | null }).lease_id;
    const finalRedirect = buildRedirectUrl(leaseId || rowLeaseId);

    if ((row as { verified_at: string | null }).verified_at) {
      return NextResponse.redirect(finalRedirect);
    }

    const expiresAt = new Date((row as { expires_at: string }).expires_at);
    if (new Date() > expiresAt) {
      return NextResponse.redirect(finalRedirect);
    }

    await serviceClient
      .from("identity_2fa_requests")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", (row as { id: string }).id);

    return NextResponse.redirect(finalRedirect);
  } catch {
    return NextResponse.redirect(BASE_URL + "/tenant/identity");
  }
}

/**
 * POST /api/tenant/identity/verify-2fa
 * Vérifie le code OTP et marque la demande 2FA comme validée.
 * Body: { token: string, otp_code: string }
 * Returns: { success: true, redirect_url: string } or error.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const token = body.token as string | undefined;
    const otpCode = (body.otp_code as string)?.trim?.();
    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 });
    }
    if (!otpCode || !/^\d{6}$/.test(otpCode)) {
      return NextResponse.json({ error: "Code à 6 chiffres requis" }, { status: 400 });
    }

    const serviceClient = getServiceClient();
    const { data: row, error: fetchError } = await serviceClient
      .from("identity_2fa_requests")
      .select("id, profile_id, lease_id, otp_hash, expires_at, verified_at")
      .eq("token", token)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: "Lien ou code invalide" }, { status: 404 });
    }

    const profileId = (row as { profile_id: string }).profile_id;
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("user_id")
      .eq("id", profileId)
      .single();
    if (!profile || (profile as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: "Cette demande ne vous appartient pas" }, { status: 403 });
    }

    if ((row as { verified_at: string | null }).verified_at) {
      const leaseId = (row as { lease_id: string | null }).lease_id;
      return NextResponse.json({ success: true, redirect_url: buildRedirectUrl(leaseId) });
    }

    const expiresAt = new Date((row as { expires_at: string }).expires_at);
    if (new Date() > expiresAt) {
      return NextResponse.json({ error: "Ce code a expiré. Demandez-en un nouveau." }, { status: 410 });
    }

    const expectedHash = (row as { otp_hash: string }).otp_hash;
    const actualHash = hashOtp(otpCode);
    if (actualHash !== expectedHash) {
      return NextResponse.json({ error: "Code incorrect" }, { status: 400 });
    }

    await serviceClient
      .from("identity_2fa_requests")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", (row as { id: string }).id);

    const leaseId = (row as { lease_id: string | null }).lease_id;
    return NextResponse.json({ success: true, redirect_url: buildRedirectUrl(leaseId) });
  } catch (error: unknown) {
    console.error("[verify-2fa] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
