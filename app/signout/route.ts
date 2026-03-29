import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /signout — Déconnexion et redirection vers /auth/signin
 *
 * Permet aux liens externes de déclencher une déconnexion propre
 * au lieu d'obtenir un 404.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const redirectUrl = new URL("/auth/signin", request.url);
  return NextResponse.redirect(redirectUrl);
}
