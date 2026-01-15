export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET - Récupérer le statut de la configuration email
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Vérifier les variables d'environnement
    const resendApiKeySet = !!process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || null;
    const emailForceSend = process.env.EMAIL_FORCE_SEND === "true";
    const nodeEnv = process.env.NODE_ENV || "development";

    // Masquer partiellement la clé API si elle existe
    let resendApiKeyPreview: string | null = null;
    if (process.env.RESEND_API_KEY) {
      const key = process.env.RESEND_API_KEY;
      resendApiKeyPreview = `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
    }

    return NextResponse.json({
      configured: resendApiKeySet,
      provider: "resend",
      emailFrom,
      emailForceSend,
      nodeEnv,
      resendApiKeyPreview,
      freeQuota: {
        monthly: 3000,
        daily: 100,
        description: "Plan gratuit Resend"
      },
      testAddress: "onboarding@resend.dev",
      documentation: "https://resend.com/docs"
    });
  } catch (error: any) {
    console.error("Erreur config email:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

