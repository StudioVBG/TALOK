// @ts-nocheck
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { setOTP } from "@/lib/services/otp-store";

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
  return Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000;
}

/**
 * POST /api/signature/[token]/send-otp
 * Envoyer un code OTP par SMS pour la signature
 */
export async function POST(request: Request, { params }: PageProps) {
  try {
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

    if (!phone) {
      return NextResponse.json(
        { error: "Numéro de téléphone requis" },
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
      phone,
      expiresAt: otpExpiry,
      attempts: 0,
    });

    // Envoyer le SMS
    await sendSMS(phone, otpCode);

    // Masquer le numéro pour la réponse
    const maskedPhone = phone.replace(/(\d{2})\d{4}(\d{2})/, "$1 ** ** $2");

    return NextResponse.json({
      success: true,
      message: `Code envoyé au ${maskedPhone}`,
      expires_in: 600, // 10 minutes en secondes
    });

  } catch (error: any) {
    console.error("Erreur API send-otp:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Envoyer un SMS avec le code OTP
 * En production, utiliser un vrai service SMS
 */
async function sendSMS(phone: string, code: string): Promise<void> {
  console.log(`📱 SMS à envoyer:`);
  console.log(`   To: ${phone}`);
  console.log(`   Code: ${code}`);
  console.log(`   Message: Votre code de signature Gestion Locative: ${code}. Valable 10 minutes.`);

  // Exemple avec Twilio (à décommenter en production)
  /*
  const twilio = require("twilio");
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await client.messages.create({
    body: `Votre code de signature Gestion Locative: ${code}. Valable 10 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  });
  */

  // Simulation d'envoi
  await new Promise(resolve => setTimeout(resolve, 200));
}
