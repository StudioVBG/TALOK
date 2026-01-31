export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron Job: Traite les webhooks en attente
 *
 * Appelé toutes les minutes par Vercel Cron ou un service externe
 * Authentifié par CRON_SECRET
 *
 * @route POST /api/cron/process-webhooks
 */

import { NextResponse } from "next/server";
import { webhookRetryService } from "@/lib/services/webhook-retry.service";
import { timingSafeEqual } from "crypto";

/**
 * Vérifie le secret CRON
 */
function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[Cron] CRON_SECRET not configured");
    return false;
  }

  // Vérifier le header Authorization
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7);

  try {
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(secret);

    if (tokenBuffer.length !== secretBuffer.length) {
      return false;
    }

    return timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // Vérifier l'authentification
    if (!verifyCronSecret(request)) {
      console.error("[Cron] Unauthorized access attempt to process-webhooks");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron] Starting webhook processing...");

    // Traiter les webhooks en attente
    const processedCount = await webhookRetryService.processPendingWebhooks(20);

    // Nettoyer les anciens webhooks (une fois par jour suffit, mais safe à appeler)
    const cleanedCount = await webhookRetryService.cleanupOldWebhooks(30);

    // Récupérer les stats
    const stats = await webhookRetryService.getStats();

    return NextResponse.json({
      success: true,
      processed: processedCount,
      cleaned: cleanedCount,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("[Cron] Error processing webhooks:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Support GET pour les crons Vercel qui utilisent GET
export async function GET(request: Request) {
  return POST(request);
}
