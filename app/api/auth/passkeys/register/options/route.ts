/**
 * API Route: Génère les options d'enregistrement WebAuthn
 * POST /api/auth/passkeys/register/options
 */

import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";

const RP_NAME = "Talok";
// Normaliser l'URL avec protocole pour éviter "Invalid URL" avec new URL()
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const normalizedAppUrl = rawAppUrl.startsWith("http") ? rawAppUrl : `https://${rawAppUrl}`;
const RP_ID = rawAppUrl ? new URL(normalizedAppUrl).hostname : "localhost";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
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

    // Récupérer le profil de l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", user.id)
      .single();

    // Récupérer les passkeys existantes de l'utilisateur
    const { data: existingCredentials } = await supabase
      .from("passkey_credentials")
      .select("credential_id")
      .eq("user_id", user.id);

    const excludeCredentials = (existingCredentials || []).map((cred) => ({
      id: cred.credential_id,
      type: "public-key" as const,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email || user.id,
      userDisplayName: profile
        ? `${profile.prenom} ${profile.nom}`
        : user.email || "Utilisateur",
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform", // Préférer Face ID / Touch ID
      },
      timeout: 60000,
    });

    // Stocker le challenge temporairement
    await supabase.from("passkey_challenges").upsert({
      user_id: user.id,
      challenge: options.challenge,
      type: "registration",
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });

    return NextResponse.json(options);
  } catch (error: unknown) {
    console.error("[Passkeys] Erreur génération options:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération des options" },
      { status: 500 }
    );
  }
}
