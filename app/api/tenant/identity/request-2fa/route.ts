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

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.length >= 2 ? local.slice(0, 2) : local.slice(0, 1) || "";
  return `${visible}***${domain}`;
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

    const profileEmail = (profile as { email?: string | null }).email?.trim();
    const email = (profileEmail && profileEmail !== "") ? profileEmail : (user?.email?.trim() || null);
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
          subject: "Validez votre identité – Talok",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Vérification d'identité</h1>
              </div>
              <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
                <p>Pour continuer, cliquez sur le bouton ci-dessous. Ce lien est valable ${OTP_EXPIRY_MINUTES} minutes.</p>
                <p style="text-align: center; margin: 28px 0;">
                  <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">Valider mon identité</a>
                </p>
                <p style="color: #64748b; font-size: 14px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
                <p style="word-break: break-all; font-size: 14px;"><a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a></p>
                <p style="color: #94a3b8; font-size: 13px; margin-top: 20px;">Vous pouvez aussi utiliser ce code à 6 chiffres dans l'application : <strong>${otpCode}</strong></p>
                <p style="color: #64748b; font-size: 14px; margin-top: 24px;">Si vous n'avez pas demandé cette vérification, ignorez cet email.</p>
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
      masked_email: maskEmail(email),
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
