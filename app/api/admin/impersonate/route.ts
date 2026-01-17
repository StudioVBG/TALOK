export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Impersonation Admin
 * 
 * Permet à un admin de se connecter en tant qu'un autre utilisateur
 * pour debug et support client.
 * 
 * SÉCURITÉ:
 * - Réservé aux admins uniquement
 * - Session limitée à 1 heure
 * - Toutes les actions sont loggées
 * - Badge visuel obligatoire côté client
 * - Impossible d'impersonner un autre admin
 * 
 * POST /api/admin/impersonate - Démarrer une session
 * DELETE /api/admin/impersonate - Terminer la session
 * GET /api/admin/impersonate - Vérifier session active
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const IMPERSONATION_COOKIE = "impersonation_session";
const MAX_DURATION_HOURS = 1;

interface ImpersonationSession {
  admin_id: string;
  admin_email: string;
  target_user_id: string;
  target_email: string;
  target_role: string;
  reason: string;
  started_at: string;
  expires_at: string;
}

/**
 * POST - Démarrer une session d'impersonation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Vérifier que c'est un admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id, role, email")
      .eq("user_id", user.id)
      .single();

    if ((adminProfile as any)?.role !== "admin") {
      return NextResponse.json(
        { error: "Seuls les admins peuvent utiliser l'impersonation" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { target_user_id, reason } = body;

    if (!target_user_id) {
      return NextResponse.json(
        { error: "target_user_id requis" },
        { status: 400 }
      );
    }

    if (!reason || reason.length < 10) {
      return NextResponse.json(
        { error: "Une raison détaillée est requise (min 10 caractères)" },
        { status: 400 }
      );
    }

    // Récupérer le profil cible
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, user_id, role, email, prenom, nom")
      .eq("user_id", target_user_id)
      .single();

    if (!targetProfile) {
      return NextResponse.json(
        { error: "Utilisateur cible non trouvé" },
        { status: 404 }
      );
    }

    // Interdire l'impersonation d'un autre admin
    if ((targetProfile as any).role === "admin") {
      return NextResponse.json(
        { error: "Impossible d'impersonner un autre administrateur" },
        { status: 403 }
      );
    }

    // Créer la session
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MAX_DURATION_HOURS * 60 * 60 * 1000);

    const session: ImpersonationSession = {
      admin_id: user.id,
      admin_email: (adminProfile as any).email || user.email || "",
      target_user_id: target_user_id,
      target_email: (targetProfile as any).email || "",
      target_role: (targetProfile as any).role,
      reason,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    // Sauvegarder dans un cookie sécurisé
    const cookieStore = await cookies();
    cookieStore.set(IMPERSONATION_COOKIE, JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: expiresAt,
      path: "/",
    });

    // Logger dans audit_log
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "impersonation_started",
      entity_type: "user",
      entity_id: target_user_id,
      metadata: {
        admin_email: session.admin_email,
        target_email: session.target_email,
        target_role: session.target_role,
        reason,
        expires_at: session.expires_at,
      },
    } as any);

    // Enregistrer dans une table dédiée pour tracking
    await supabase.from("impersonation_sessions").insert({
      admin_id: user.id,
      target_user_id: target_user_id,
      reason,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "active",
    } as any).catch(() => {
      // Table optionnelle, ne pas bloquer si elle n'existe pas
    });

    return NextResponse.json({
      success: true,
      session: {
        target_user_id: session.target_user_id,
        target_email: session.target_email,
        target_role: session.target_role,
        expires_at: session.expires_at,
      },
      message: `Session d'impersonation active pour ${(targetProfile as any).prenom} ${(targetProfile as any).nom}`,
    });

  } catch (error: unknown) {
    console.error("[admin/impersonate] Erreur POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET - Vérifier si une session d'impersonation est active
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(IMPERSONATION_COOKIE);

    if (!sessionCookie?.value) {
      return NextResponse.json({
        active: false,
        session: null,
      });
    }

    const session: ImpersonationSession = JSON.parse(sessionCookie.value);

    // Vérifier si la session a expiré
    if (new Date(session.expires_at) < new Date()) {
      // Supprimer le cookie expiré
      cookieStore.delete(IMPERSONATION_COOKIE);
      return NextResponse.json({
        active: false,
        session: null,
        message: "Session expirée",
      });
    }

    return NextResponse.json({
      active: true,
      session: {
        admin_email: session.admin_email,
        target_user_id: session.target_user_id,
        target_email: session.target_email,
        target_role: session.target_role,
        started_at: session.started_at,
        expires_at: session.expires_at,
        remaining_minutes: Math.round(
          (new Date(session.expires_at).getTime() - Date.now()) / 60000
        ),
      },
    });

  } catch (error: unknown) {
    console.error("[admin/impersonate] Erreur GET:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Terminer la session d'impersonation
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(IMPERSONATION_COOKIE);

    if (sessionCookie?.value) {
      const session: ImpersonationSession = JSON.parse(sessionCookie.value);

      // Logger la fin de session
      if (user) {
        await supabase.from("audit_log").insert({
          user_id: user.id,
          action: "impersonation_ended",
          entity_type: "user",
          entity_id: session.target_user_id,
          metadata: {
            admin_email: session.admin_email,
            target_email: session.target_email,
            duration_minutes: Math.round(
              (Date.now() - new Date(session.started_at).getTime()) / 60000
            ),
          },
        } as any);

        // Mettre à jour la table de tracking
        await supabase
          .from("impersonation_sessions")
          .update({
            ended_at: new Date().toISOString(),
            status: "ended",
          } as any)
          .eq("admin_id", user.id)
          .eq("target_user_id", session.target_user_id)
          .eq("status", "active")
          .catch(() => {});
      }
    }

    // Supprimer le cookie
    cookieStore.delete(IMPERSONATION_COOKIE);

    return NextResponse.json({
      success: true,
      message: "Session d'impersonation terminée",
    });

  } catch (error: unknown) {
    console.error("[admin/impersonate] Erreur DELETE:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

