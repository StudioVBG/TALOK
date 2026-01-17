/**
 * API Route: Vérifie et enregistre une nouvelle passkey
 * POST /api/auth/passkeys/register/verify
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

// Normaliser l'URL avec protocole pour éviter "Invalid URL" avec new URL()
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const normalizedAppUrl = rawAppUrl.startsWith("http") ? rawAppUrl : `https://${rawAppUrl}`;
const RP_ID = rawAppUrl ? new URL(normalizedAppUrl).hostname : "localhost";
const ORIGIN = normalizedAppUrl || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { credential, friendlyName } = body;

    if (!credential) {
      return NextResponse.json(
        { error: "Credential manquant" },
        { status: 400 }
      );
    }

    // Récupérer le challenge stocké
    const { data: challengeData, error: challengeError } = await serviceClient
      .from("passkey_challenges")
      .select("challenge")
      .eq("user_id", user.id)
      .eq("type", "registration")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (challengeError || !challengeData) {
      return NextResponse.json(
        { error: "Challenge expiré ou invalide" },
        { status: 400 }
      );
    }

    // Vérifier la réponse d'enregistrement
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Vérification échouée" },
        { status: 400 }
      );
    }

    const { registrationInfo } = verification;

    // Encoder le credential ID et la clé publique en base64
    const credentialIdBase64 = Buffer.from(registrationInfo.credential.id).toString("base64url");
    const publicKeyBase64 = Buffer.from(registrationInfo.credential.publicKey).toString("base64");

    // Enregistrer la passkey dans la base de données
    const { error: insertError } = await serviceClient
      .from("passkey_credentials")
      .insert({
        user_id: user.id,
        credential_id: credentialIdBase64,
        public_key: publicKeyBase64,
        counter: registrationInfo.credential.counter,
        device_type: registrationInfo.credentialDeviceType,
        backed_up: registrationInfo.credentialBackedUp,
        transports: credential.response.transports || [],
        friendly_name: friendlyName || "Ma passkey",
      });

    if (insertError) {
      console.error("[Passkeys] Erreur insertion:", insertError);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement" },
        { status: 500 }
      );
    }

    // Supprimer le challenge utilisé
    await serviceClient
      .from("passkey_challenges")
      .delete()
      .eq("user_id", user.id)
      .eq("type", "registration");

    return NextResponse.json({
      success: true,
      message: "Passkey enregistrée avec succès",
    });
  } catch (error: unknown) {
    console.error("[Passkeys] Erreur vérification:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500 }
    );
  }
}
