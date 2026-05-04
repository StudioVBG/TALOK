/**
 * API Route: Génère les options d'enregistrement WebAuthn
 * POST /api/auth/passkeys/register/options
 */

import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

const RP_NAME = "Talok";
// Normaliser l'URL avec protocole pour éviter "Invalid URL" avec new URL()
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const normalizedAppUrl = rawAppUrl.startsWith("http") ? rawAppUrl : `https://${rawAppUrl}`;
const RP_ID = rawAppUrl ? new URL(normalizedAppUrl).hostname : "localhost";

export async function POST(_request: NextRequest) {
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

    // Récupérer les passkeys existantes de l'utilisateur (pour exclusion)
    const { data: existingCredentials } = await supabase
      .from("passkey_credentials")
      .select("credential_id, transports")
      .eq("user_id", user.id);

    const excludeCredentials = (existingCredentials || []).map((cred) => ({
      id: cred.credential_id as string,
      type: "public-key" as const,
      transports: (cred.transports as string[] | null) || undefined,
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
      excludeCredentials: excludeCredentials as any,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        // Pas de authenticatorAttachment : on autorise platform (Touch ID,
        // Face ID, Windows Hello) ET cross-platform (YubiKey, clés FIDO2)
      },
      timeout: 60000,
    });

    // Stocker le challenge via le service client (RLS reservee au service_role).
    // Pattern delete+insert pour garantir un seul challenge actif par (user, type)
    // sans dependre d'un index unique : en prod l'index partiel peut manquer ou
    // PostgREST peut avoir cache un ancien schema, ce qui faisait echouer
    // l'upsert avec onConflict (cause du 500 "Erreur lors de la preparation").
    const serviceClient = getServiceClient();

    const { error: deleteError } = await serviceClient
      .from("passkey_challenges")
      .delete()
      .eq("user_id", user.id)
      .eq("type", "registration");

    if (deleteError) {
      console.error("[Passkeys] Erreur nettoyage challenge:", {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
      });
      return NextResponse.json(
        { error: "Erreur lors de la préparation de l'enregistrement" },
        { status: 500 }
      );
    }

    const { error: challengeError } = await serviceClient
      .from("passkey_challenges")
      .insert({
        user_id: user.id,
        challenge: options.challenge,
        type: "registration",
        expires_at: new Date(Date.now() + 60000).toISOString(),
      });

    if (challengeError) {
      console.error("[Passkeys] Erreur stockage challenge:", {
        code: challengeError.code,
        message: challengeError.message,
        details: challengeError.details,
        hint: challengeError.hint,
      });
      return NextResponse.json(
        { error: "Erreur lors de la préparation de l'enregistrement" },
        { status: 500 }
      );
    }

    return NextResponse.json(options);
  } catch (error: unknown) {
    console.error("[Passkeys] Erreur génération options:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération des options" },
      { status: 500 }
    );
  }
}
