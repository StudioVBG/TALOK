export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { authenticator } from "otplib";

/**
 * POST /api/auth/2fa/disable - Désactiver la 2FA (P1-1)
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
    const { token } = body;

    // Vérifier le token si fourni (sécurité supplémentaire)
    if (token) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("two_factor_secret")
        .eq("user_id", user.id as any)
        .single();

      if (profile && (profile as any).two_factor_secret) {
        const secret = (profile as any).two_factor_secret;
        const isValid = authenticator.verify({
          token,
          secret,
        });

        if (!isValid) {
          return NextResponse.json(
            { error: "Token invalide" },
            { status: 400 }
          );
        }
      }
    }

    // Désactiver la 2FA
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
      } as any)
      .eq("user_id", user.id as any);

    if (updateError) throw updateError;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "2fa_disabled",
      entity_type: "user",
      entity_id: user.id,
    } as any);

    return NextResponse.json({
      success: true,
      message: "2FA désactivée avec succès",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}





