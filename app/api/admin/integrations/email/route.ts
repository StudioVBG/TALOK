export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

// GET - Récupérer le statut de la configuration email
export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.integrations.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

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
  } catch (error: unknown) {
    console.error("Erreur config email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

