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
    const body = await request.json();
    const { email } = body;

    const serviceClient = getServiceClient();

    let allowCredentials: { id: string; type: "public-key" }[] = [];

    // Si email fourni, récupérer les passkeys de l'utilisateur
    if (email) {
      const { data: userData } = await serviceClient
        .from("profiles")
        .select("user_id")
        .eq("user_id", serviceClient.auth.admin
          ? undefined
          : undefined)
        .single();

      // Rechercher l'utilisateur par email via auth.users
      const { data: authUser } = await serviceClient.auth.admin.listUsers();
      const user = authUser?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (user) {
        const { data: credentials } = await serviceClient
          .from("passkey_credentials")
          .select("credential_id, transports")
          .eq("user_id", user.id);

        allowCredentials = (credentials || []).map((cred) => ({
          id: cred.credential_id,
          type: "public-key" as const,
          transports: cred.transports,
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: "preferred",
      timeout: 60000,
    });

    // Stocker le challenge (sans user_id si pas connecté)
    const challengeId = crypto.randomUUID();
    await serviceClient.from("passkey_challenges").insert({
      id: challengeId,
      user_id: null, // Sera vérifié après
      challenge: options.challenge,
      type: "authentication",
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });

    return NextResponse.json({
      ...options,
      challengeId, // Renvoyer l'ID pour la vérification
    });
  } catch (error: unknown) {
    console.error("[Passkeys] Erreur génération options auth:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération des options" },
      { status: 500 }
    );
  }
}
