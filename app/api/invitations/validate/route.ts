export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { resolveInvitationByToken } from "@/lib/invitations/server-resolver";

/**
 * GET /api/invitations/validate?token=xxx
 *
 * Valide un token d'invitation côté serveur avec service_role et résout
 * indistinctement les invitations bail (`invitations`) et garant standalone
 * (`guarantor_invitations`) via lib/invitations/server-resolver.
 *
 * Cette route est publique (pas d'auth requise) car l'utilisateur
 * peut ne pas encore avoir de compte.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token || token.length < 10) {
      return NextResponse.json(
        { valid: false, error: "Token manquant ou invalide" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();
    const result = await resolveInvitationByToken(serviceClient as any, token);

    if (!result.ok) {
      const message = (() => {
        switch (result.error.kind) {
          case "not_found":
            return "Invitation non trouvée";
          case "expired":
            return "Cette invitation a expiré. Demandez un nouveau lien à votre propriétaire.";
          case "already_used":
            return "Cette invitation a déjà été utilisée.";
          case "declined":
            return "Cette invitation a été refusée.";
        }
      })();
      return NextResponse.json({ valid: false, error: message });
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        id: result.invitation.id,
        email: result.invitation.email,
        role: result.invitation.invitationRole,
        source: result.invitation.source,
      },
    });
  } catch (error) {
    console.error("[validate-invitation] Erreur:", error);
    return NextResponse.json(
      { valid: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
