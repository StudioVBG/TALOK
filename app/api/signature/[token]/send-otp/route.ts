export const runtime = 'nodejs';

// @ts-nocheck
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { setOTP } from "@/lib/services/otp-store";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { sendOTPSMS, smsUtils } from "@/lib/services/sms.service";
import { sendEmail } from "@/lib/email/send-email";

interface PageProps {
  params: Promise<{ token: string }>;
}

// Décoder le token (format: leaseId:email:timestamp en base64url)
function decodeToken(token: string): { leaseId: string; tenantEmail: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [leaseId, tenantEmail, timestampStr] = decoded.split(":");
    if (!leaseId || !tenantEmail || !timestampStr) return null;
    return { leaseId, tenantEmail, timestamp: parseInt(timestampStr, 10) };
  } catch {
    return null;
  }
}

// Vérifier si le token est expiré (7 jours)
function isTokenExpired(timestamp: number): boolean {
  return Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000;
}

/**
 * POST /api/signature/[token]/send-otp
 * Envoyer un code OTP par SMS pour la signature
 */
export async function POST(request: Request, { params }: PageProps) {
  try {
    // Rate limiting strict pour les SMS (3/minute max pour éviter les abus)
    const rateLimitResponse = applyRateLimit(request, "sms");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { token } = await params;

    // Décoder le token
    const tokenData = decodeToken(token);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Lien d'invitation invalide" },
        { status: 404 }
      );
    }

    // Vérifier expiration
    if (isTokenExpired(tokenData.timestamp)) {
      return NextResponse.json(
        { error: "Le lien d'invitation a expiré" },
        { status: 410 }
      );
    }

    const serviceClient = getServiceClient();

    // Récupérer le bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, statut")
      .eq("id", tokenData.leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const phone = body.phone;
    const countryCode = body.countryCode; // Indicatif pays optionnel (ex: "596")
    const method = body.method || "sms"; // "sms" ou "email"
    const email = body.email;

    // Validation selon la méthode
    if (method === "sms" && !phone) {
      return NextResponse.json(
        { error: "Numéro de téléphone requis" },
        { status: 400 }
      );
    }
    
    if (method === "email" && !email) {
      return NextResponse.json(
        { error: "Email requis pour cette méthode" },
        { status: 400 }
      );
    }

    // Générer un code OTP à 6 chiffres
    const otpCode = randomInt(100000, 999999).toString();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // Expire dans 10 minutes

    // Stocker le code OTP
    setOTP(tokenData.leaseId, {
      code: otpCode,
      phone: phone || email,
      expiresAt: otpExpiry,
      attempts: 0,
    });

    // Envoyer selon la méthode choisie
    if (method === "email") {
      // Envoi par email
      try {
        await sendEmail({
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

        const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, "$1***$3");
        
        return NextResponse.json({
          success: true,
          message: `Code envoyé à ${maskedEmail}`,
          expires_in: 600,
          method: "email",
        });
      } catch (emailError: any) {
        console.error("[OTP] Erreur envoi email:", emailError);
        return NextResponse.json(
          { error: "Erreur d'envoi de l'email. Essayez par SMS." },
          { status: 500 }
        );
      }
    }

    // Envoi par SMS (méthode par défaut)
    // Formater le numéro avec le code pays si fourni
    let formattedPhone = phone;
    if (countryCode) {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      const phoneWithoutLeadingZero = cleanPhone.startsWith("0") 
        ? cleanPhone.substring(1) 
        : cleanPhone;
      formattedPhone = `+${countryCode}${phoneWithoutLeadingZero}`;
    }

    const smsResult = await sendOTPSMS(formattedPhone, otpCode, {
      appName: "Talok",
      expiryMinutes: 10,
    });

    if (!smsResult.success) {
      console.error("[OTP] Erreur envoi SMS:", smsResult.error);
      return NextResponse.json(
        { 
          error: smsResult.error || "Erreur d'envoi du code SMS",
          suggestion: "Essayez la méthode par email",
          allow_email_fallback: true,
        },
        { status: 500 }
      );
    }

    // Masquer le numéro pour la réponse
    const maskedPhone = formattedPhone.replace(/(\+\d{2,3})(\d{3})(\d+)(\d{2})/, "$1 $2 *** $4");

    return NextResponse.json({
      success: true,
      message: `Code envoyé au ${maskedPhone}`,
      expires_in: 600, // 10 minutes en secondes
      simulated: smsResult.simulated || false,
      method: "sms",
    });

  } catch (error: any) {
    console.error("Erreur API send-otp:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
