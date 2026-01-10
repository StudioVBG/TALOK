/**
 * API Route: Vérifie l'authentification WebAuthn
 * POST /api/auth/passkeys/authenticate/verify
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getServiceClient } from "@/lib/supabase/service-client";

// Normaliser l'URL avec protocole pour éviter "Invalid URL" avec new URL()
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const normalizedAppUrl = rawAppUrl.startsWith("http") ? rawAppUrl : `https://${rawAppUrl}`;
const RP_ID = rawAppUrl ? new URL(normalizedAppUrl).hostname : "localhost";
const ORIGIN = normalizedAppUrl || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credential, challengeId } = body;

    if (!credential || !challengeId) {
      return NextResponse.json(
        { error: "Credential ou challengeId manquant" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    // Récupérer le challenge stocké
    const { data: challengeData, error: challengeError } = await serviceClient
      .from("passkey_challenges")
      .select("challenge")
      .eq("id", challengeId)
      .eq("type", "authentication")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (challengeError || !challengeData) {
      return NextResponse.json(
        { error: "Challenge expiré ou invalide" },
        { status: 400 }
      );
    }

    // Trouver la passkey correspondante
    const credentialIdFromResponse = credential.id;

    const { data: storedCredential, error: credError } = await serviceClient
      .from("passkey_credentials")
      .select("*")
      .eq("credential_id", credentialIdFromResponse)
      .single();

    if (credError || !storedCredential) {
      return NextResponse.json(
        { error: "Passkey non trouvée" },
        { status: 400 }
      );
    }

    // Décoder la clé publique
    const publicKey = Buffer.from(storedCredential.public_key, "base64");

    // Vérifier la réponse d'authentification
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: storedCredential.credential_id,
        publicKey: new Uint8Array(publicKey),
        counter: storedCredential.counter,
        transports: storedCredential.transports,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Vérification échouée" },
        { status: 400 }
      );
    }

    // Mettre à jour le counter et last_used_at
    await serviceClient
      .from("passkey_credentials")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", storedCredential.id);

    // Supprimer le challenge utilisé
    await serviceClient
      .from("passkey_challenges")
      .delete()
      .eq("id", challengeId);

    // Récupérer l'utilisateur pour créer une session
    const { data: authUser } = await serviceClient.auth.admin.getUserById(
      storedCredential.user_id
    );

    if (!authUser?.user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 400 }
      );
    }

    // Générer un magic link pour créer la session
    const { data: magicLinkData, error: magicLinkError } =
      await serviceClient.auth.admin.generateLink({
        type: "magiclink",
        email: authUser.user.email!,
      });

    if (magicLinkError) {
      return NextResponse.json(
        { error: "Erreur création session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      // Renvoyer les tokens pour établir la session côté client
      access_token: magicLinkData.properties?.access_token,
      refresh_token: magicLinkData.properties?.refresh_token,
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
      },
    });
  } catch (error: any) {
    console.error("[Passkeys] Erreur vérification auth:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500 }
    );
  }
}
