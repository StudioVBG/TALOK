export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { setOTP } from "@/lib/services/otp-store";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { sendEmail } from "@/lib/email/send-email";
import { verifyTokenCompat } from "@/lib/utils/secure-token";

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * POST /api/signature/[token]/send-otp
 * Envoyer un code OTP par email pour la signature de bail.
 */
export async function POST(request: Request, { params }: PageProps) {
  try {
    const rateLimitResponse = applyRateLimit(request, "email");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { token } = await params;

    const tokenData = verifyTokenCompat(token, 7);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Lien d'invitation invalide ou expiré" },
        { status: 410 }
      );
    }

    const serviceClient = getServiceClient();

    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, statut")
      .eq("id", tokenData.entityId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (!email) {
      return NextResponse.json(
        { error: "Adresse email requise pour recevoir le code." },
        { status: 400 }
      );
    }

    const otpCode = randomInt(100000, 999999).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    setOTP(tokenData.entityId, {
      code: otpCode,
      phone: email,
      expiresAt: otpExpiry,
      attempts: 0,
    });

    try {
      const emailResult = await sendEmail({
        to: email,
        subject: "Code de vérification - Signature de bail",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Code de vérification</h1>
              </div>
              <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
                <p>Voici votre code de vérification pour signer votre bail :</p>
                <div style="background: white; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 20px 0;">
                  ${otpCode}
                </div>
                <p style="color: #64748b; font-size: 14px;">Ce code est valable 10 minutes.</p>
                <p style="color: #64748b; font-size: 14px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
              </div>
            </div>
          `,
      });

      if (!emailResult.success) {
        console.error("[OTP] Erreur envoi email:", emailResult.error);
        return NextResponse.json(
          {
            error:
              "Impossible d'envoyer le code par email. Vérifiez votre adresse ou réessayez plus tard.",
          },
          { status: 500 }
        );
      }

      const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, "$1***$3");
      return NextResponse.json({
        success: true,
        message: `Code envoyé à ${maskedEmail}`,
        expires_in: 600,
        method: "email",
      });
    } catch (emailError: unknown) {
      console.error("[OTP] Erreur envoi email:", emailError);
      return NextResponse.json(
        {
          error:
            "Impossible d'envoyer le code par email. Vérifiez votre adresse ou réessayez plus tard.",
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Erreur API send-otp:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
