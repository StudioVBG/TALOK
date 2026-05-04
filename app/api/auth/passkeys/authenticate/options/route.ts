/**
 * API Route: Génère les options d'authentification WebAuthn
 * POST /api/auth/passkeys/authenticate/options
 */

import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getServiceClient } from "@/lib/supabase/service-client";

// Normaliser l'URL avec protocole pour éviter "Invalid URL" avec new URL()
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const normalizedAppUrl = rawAppUrl.startsWith("http") ? rawAppUrl : `https://${rawAppUrl}`;
const RP_ID = rawAppUrl ? new URL(normalizedAppUrl).hostname : "localhost";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email: string | undefined = typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : undefined;

    const serviceClient = getServiceClient();

    let allowCredentials: {
      id: string;
      type: "public-key";
      transports?: string[];
    }[] = [];

    // Si email fourni, restreindre les credentials autorises a ceux de l'utilisateur.
    // Lookup direct par email via la table profiles (pas de listUsers paginee).
    if (email) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (profile?.user_id) {
        const { data: credentials } = await serviceClient
          .from("passkey_credentials")
          .select("credential_id, transports")
          .eq("user_id", profile.user_id);

        allowCredentials = (credentials || []).map((cred) => ({
          id: cred.credential_id as string,
          type: "public-key" as const,
          transports: (cred.transports as string[] | null) || undefined,
        }));
      }
      // Si pas trouve : on ne revele rien et on genere quand meme des options
      // (le navigateur affichera les passkeys disponibles via discoverable cred).
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: "preferred",
      timeout: 60000,
    });

    // Stocker le challenge (sans user_id, identifie par UUID retourne au client)
    const challengeId = crypto.randomUUID();
    const { error: challengeError } = await serviceClient
      .from("passkey_challenges")
      .insert({
        id: challengeId,
        user_id: null,
        challenge: options.challenge,
        type: "authentication",
        expires_at: new Date(Date.now() + 60000).toISOString(),
      });

    if (challengeError) {
      console.error("[Passkeys] Erreur stockage challenge auth:", challengeError);
      return NextResponse.json(
        { error: "Erreur lors de la préparation de la connexion" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...options,
      challengeId,
    });
  } catch (error: unknown) {
    console.error("[Passkeys] Erreur génération options auth:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération des options" },
      { status: 500 }
    );
  }
}
