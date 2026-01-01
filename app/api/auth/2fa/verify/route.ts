export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { authenticator } from "otplib";

/**
 * POST /api/auth/2fa/verify - Vérifier et activer la 2FA (P1-1)
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

    if (!token) {
      return NextResponse.json(
        { error: "Token requis" },
        { status: 400 }
      );
    }

    // Récupérer le secret de l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("two_factor_secret")
      .eq("user_id", user.id as any)
      .single();

    if (!profile || !(profile as any).two_factor_secret) {
      return NextResponse.json(
        { error: "2FA non initialisée. Appelez d'abord /enable" },
        { status: 400 }
      );
    }

    const secret = (profile as any).two_factor_secret;

    // Vérifier le token
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

    // Activer la 2FA
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        two_factor_enabled: true,
      } as any)
      .eq("user_id", user.id as any);

    if (updateError) throw updateError;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "2fa_enabled",
      entity_type: "user",
      entity_id: user.id,
    } as any);

    return NextResponse.json({
      success: true,
      message: "2FA activée avec succès",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}





