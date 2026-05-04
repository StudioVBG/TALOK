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
    // requireUserVerification: false car on demande "preferred" cote client.
    // Si l'authenticateur fait quand meme la UV (Touch ID/Face ID), elle sera
    // verifiee par WebAuthn ; sinon on accepte (cle de securite sans biometrie).
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge as string,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      // Toujours nettoyer le challenge meme en cas d'echec
      await serviceClient
        .from("passkey_challenges")
        .delete()
        .eq("user_id", user.id)
        .eq("type", "registration");

      return NextResponse.json(
        { error: "Vérification échouée" },
        { status: 400 }
      );
    }

    const { registrationInfo } = verification;

    // @simplewebauthn/server v13 : registrationInfo.credential.id est deja une
    // Base64URLString (string), on la stocke telle quelle. Re-encoder via
    // Buffer.from(str).toString('base64url') donnerait la base64-de-l'ASCII et
    // casserait le lookup au login. La publicKey reste un Uint8Array.
    const credentialIdBase64 = registrationInfo.credential.id;
    const publicKeyBase64 = Buffer.from(registrationInfo.credential.publicKey).toString("base64");

    // Calculer un friendly_name unique pour cet utilisateur
    // (l'index unique (user_id, friendly_name) interdit les doublons)
    const baseName = (friendlyName as string)?.trim() || "Ma passkey";
    const { data: existingNames } = await serviceClient
      .from("passkey_credentials")
      .select("friendly_name")
      .eq("user_id", user.id);

    const usedNames = new Set(
      (existingNames || []).map((c) => c.friendly_name as string)
    );
    let finalName = baseName;
    let suffix = 2;
    while (usedNames.has(finalName)) {
      finalName = `${baseName} (${suffix})`;
      suffix += 1;
    }

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
        friendly_name: finalName,
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
