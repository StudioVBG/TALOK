export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { randomInt, createHmac, randomBytes } from "crypto";
import { sendEmail } from "@/lib/email/send-email";
import { applyRateLimit } from "@/lib/middleware/rate-limit";

const OTP_EXPIRY_MINUTES = 10;
const OTP_SECRET = process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "identity-2fa-fallback";

function hashOtp(otpCode: string): string {
  return createHmac("sha256", OTP_SECRET).update(otpCode).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * POST /api/tenant/identity/request-2fa
 * Demande une vérification 2FA par email uniquement (code + lien) pour renouvellement / mise à jour CNI.
 * Body: { lease_id: string, action: "renew" | "upload" }
 */
export async function POST(request: Request) {
  try {
    const rateLimitResponse = applyRateLimit(request, "email");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const leaseId = body.lease_id as string | undefined;
    const action = (body.action as string) || "renew";
    if (!["renew", "upload", "initial", "update"].includes(action)) {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, email, telephone")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const email = (profile as { email?: string | null }).email;
    if (!email) {
      return NextResponse.json(
        { error: "Ajoutez une adresse email à votre profil pour recevoir le code de vérification." },
        { status: 400 }
      );
    }

    const otpCode = randomInt(100000, 999999).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
    const token = generateToken();
    const otpHash = hashOtp(otpCode);
    const dbAction = (action === "upload" ? "update" : action) as "renew" | "initial" | "update";

    await serviceClient.from("identity_2fa_requests").insert({
      profile_id: profile.id,
      action: dbAction,
      lease_id: leaseId || null,
      otp_hash: otpHash,
      token,
      expires_at: expiresAt.toISOString(),
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";
    const verifyUrl = `${appUrl}/api/tenant/identity/verify-2fa?token=${encodeURIComponent(token)}${leaseId ? `&lease_id=${encodeURIComponent(leaseId)}` : ""}`;

    let emailSent = false;
    const channelsFailed: { channel: string; error: string }[] = [];

    try {
      const emailResult = await sendEmail({
          to: email,
          subject: "Vérification d'identité - Code et lien Talok",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Vérification d'identité</h1>
              </div>
              <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
                <p>Voici votre code de vérification à 6 chiffres :</p>
                <div style="background: white; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 20px 0;">
                  ${otpCode}
                </div>
                <p>Ce code est valable ${OTP_EXPIRY_MINUTES} minutes.</p>
                <p>Vous pouvez aussi cliquer sur le lien ci-dessous pour valider directement :</p>
                <p><a href="${verifyUrl}" style="color: #2563eb; word-break: break-all;">${verifyUrl}</a></p>
                <p style="color: #64748b; font-size: 14px;">Si vous n'avez pas demandé cette vérification, ignorez cet email.</p>
              </div>
            </div>
          `,
        });
      if (emailResult.success) {
        emailSent = true;
      } else {
        channelsFailed.push({ channel: "email", error: emailResult.error || "Échec email" });
      }
    } catch (emailErr) {
      channelsFailed.push({ channel: "email", error: String(emailErr) });
      console.warn("[request-2fa] Email failed:", emailErr);
    }

    if (!emailSent) {
      return NextResponse.json(
        {
          success: false,
          error: "Impossible d'envoyer le code par email. Vérifiez la configuration email (Admin > Intégrations).",
          channels_failed: channelsFailed,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Code envoyé par email",
      channels_sent: ["email"],
      channels_failed: channelsFailed,
      expires_in: OTP_EXPIRY_MINUTES * 60,
      token,
    });
  } catch (error: unknown) {
    console.error("[request-2fa] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
