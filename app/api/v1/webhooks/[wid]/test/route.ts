export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  requireRole,
  requireApiAccess,
} from "@/lib/api/middleware";
import { sendTestWebhook } from "@/lib/api/webhooks";

/**
 * POST /api/v1/webhooks/[wid]/test
 * Send a test webhook to verify the endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wid: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const apiAccessCheck = await requireApiAccess(auth.profile);
    if (apiAccessCheck) return apiAccessCheck;

    const { wid } = await params;

    const result = await sendTestWebhook(wid, auth.profile.id);

    if (result.success) {
      return apiSuccess({
        success: true,
        status_code: result.statusCode,
        message: "Test webhook envoyé avec succès",
      });
    }

    return apiSuccess({
      success: false,
      status_code: result.statusCode || null,
      error: result.error || "Échec de l'envoi",
    });
  } catch (error: unknown) {
    console.error("[POST /v1/webhooks/:id/test] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}
