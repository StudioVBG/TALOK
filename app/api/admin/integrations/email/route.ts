export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { getEmailConfigurationStatus } from "@/lib/services/email-service";

/**
 * @maintenance Route utilitaire admin — usage ponctuel
 * @description Récupère le statut de la configuration email (provider, domaine, DKIM)
 * @usage GET /api/admin/integrations/email
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.integrations.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    const status = await getEmailConfigurationStatus();

    // Masquer partiellement la clé API si elle existe
    let resendApiKeyPreview: string | null = null;
    if (process.env.RESEND_API_KEY) {
      const key = process.env.RESEND_API_KEY;
      resendApiKeyPreview = `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
    }

    return NextResponse.json({
      configured: status.configured,
      canSendLive: status.canSendLive,
      provider: status.provider,
      deliveryMode: status.deliveryMode,
      emailFrom: status.resolved.fromAddress,
      emailReplyTo: status.resolved.replyTo,
      emailForceSend: status.env.forceSend,
      nodeEnv: status.nodeEnv,
      apiKeySource: status.sources.apiKey,
      fromAddressSource: status.sources.fromAddress,
      dbFallbackAvailable: status.database.available,
      dbCredentialEnv: status.database.credentialEnv,
      dbCheckFailed: status.database.checkFailed,
      hasAppUrl: status.env.hasAppUrl,
      hasPasswordResetCookieSecret: status.env.hasPasswordResetCookieSecret,
      warnings: status.warnings,
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

