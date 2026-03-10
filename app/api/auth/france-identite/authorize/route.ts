export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FRANCECONNECT_AUTHORIZATION_ENDPOINT =
  "https://app.franceconnect.gouv.fr/api/v1/authorize";

const SCOPES = [
  "openid",
  "given_name",
  "family_name",
  "birthdate",
  "birthplace",
  "birthcountry",
  "gender",
  "email",
];

/**
 * POST /api/auth/france-identite/authorize
 * Initie le flow FranceConnect pour la vérification d'identité
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { context, callback_url } = body;

    const clientId = process.env.FRANCECONNECT_CLIENT_ID;
    const redirectUri = process.env.FRANCECONNECT_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "FranceConnect non configuré" },
        { status: 503 }
      );
    }

    // Générer state et nonce pour la sécurité OIDC
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    // Stocker le state dans la session pour validation au callback
    await supabase.from("franceconnect_sessions").insert({
      user_id: user.id,
      state,
      nonce,
      context: context || "identity_verification",
      callback_url: callback_url || "/",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
    } as any);

    // Construire l'URL d'autorisation FranceConnect
    const authUrl = new URL(FRANCECONNECT_AUTHORIZATION_ENDPOINT);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("acr_values", "eidas2"); // Niveau substantiel

    return NextResponse.json({
      authorization_url: authUrl.toString(),
      state,
    });
  } catch (error: unknown) {
    console.error("[france-identite/authorize] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
