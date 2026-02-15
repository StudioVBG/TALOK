export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/invitations/validate?token=xxx
 *
 * FIX P1-E9: Valide un token d'invitation côté serveur avec service_role.
 * Remplace l'appel direct via invitationsService (client-side, anon key)
 * qui échouait sur les RLS pour les utilisateurs non connectés.
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

    // Récupérer l'invitation par token
    const { data: invitation, error: invError } = await serviceClient
      .from("invitations")
      .select("id, email, role, property_id, lease_id, expires_at, used_at")
      .eq("token", token)
      .single();

    if (invError || !invitation) {
      return NextResponse.json({
        valid: false,
        error: "Invitation non trouvée",
      });
    }

    // Vérifier l'expiration
    if (new Date(invitation.expires_at as string) < new Date()) {
      return NextResponse.json({
        valid: false,
        error: "Cette invitation a expiré. Demandez un nouveau lien à votre propriétaire.",
      });
    }

    // Vérifier si déjà utilisée
    if (invitation.used_at) {
      return NextResponse.json({
        valid: false,
        error: "Cette invitation a déjà été utilisée.",
      });
    }

    // Retourner les données publiques de l'invitation (sans le token lui-même)
    return NextResponse.json({
      valid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
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
