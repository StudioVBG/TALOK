export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ModerationActionType = "warn" | "restrict" | "suspend" | "unsuspend" | "ban" | "unban" | "verify" | "note";

/**
 * GET /api/admin/people/owners/[id]/moderation
 * Récupère l'état de modération d'un propriétaire
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ownerId } = await params;
    const { error, user } = await requireAdmin(request);

    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: error.status });
    }

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Récupérer le profil et son état
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id, account_status, suspended_at, suspended_reason")
      .eq("id", ownerId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Propriétaire non trouvé" }, { status: 404 });
    }

    // Récupérer les flags (si table existe)
    let flags: any[] = [];
    try {
      const { data: flagsData } = await supabase
        .from("account_flags")
        .select("*")
        .eq("profile_id", ownerId)
        .order("created_at", { ascending: false });
      flags = flagsData || [];
    } catch {
      // Table doesn't exist yet
    }

    // Récupérer l'historique des actions de modération (si table existe)
    let history: any[] = [];
    try {
      const { data: historyData } = await supabase
        .from("moderation_actions")
        .select("*")
        .eq("target_profile_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(50);
      history = historyData || [];
    } catch {
      // Table doesn't exist yet
    }

    // Récupérer les notes admin (si table existe)
    let notes: any[] = [];
    try {
      const { data: notesData } = await supabase
        .from("admin_notes")
        .select("*, author:profiles!admin_notes_author_id_fkey(prenom, nom)")
        .eq("target_profile_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(20);
      notes = (notesData || []).map((n: any) => ({
        id: n.id,
        content: n.content,
        author: n.author ? `${n.author.prenom} ${n.author.nom}` : "Admin",
        createdAt: n.created_at,
      }));
    } catch {
      // Table doesn't exist yet
    }

    // Récupérer la dernière connexion
    let lastLogin: string | null = null;
    if (profile.user_id) {
      const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
      lastLogin = userData?.user?.last_sign_in_at || null;
    }

    // Déterminer le statut du compte
    let accountStatus = "active";
    const profileData = profile as any;
    if (profileData.account_status) {
      accountStatus = profileData.account_status;
    } else if (profileData.suspended_at) {
      accountStatus = "suspended";
    }

    return NextResponse.json({
      accountStatus,
      flags: flags.map((f: any) => ({
        id: f.id,
        type: f.type,
        severity: f.severity,
        description: f.description,
        detectedAt: f.created_at,
        resolved: f.resolved,
        resolvedAt: f.resolved_at,
      })),
      history: history.map((h: any) => ({
        id: h.id,
        type: h.action_type,
        reason: h.reason,
        performedBy: h.performed_by_name || "Admin",
        performedAt: h.created_at,
        expiresAt: h.expires_at,
        metadata: h.metadata,
      })),
      notes,
      lastLogin,
    });
  } catch (error: unknown) {
    console.error("[GET /api/admin/people/owners/[id]/moderation]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/people/owners/[id]/moderation
 * Effectue une action de modération sur un propriétaire
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ownerId } = await params;
    const { error, user, supabase: adminSupabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: error.status });
    }

    if (!user || !adminSupabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { action, reason } = body as { action: ModerationActionType; reason: string };

    if (!action || !reason) {
      return NextResponse.json(
        { error: "Action et raison requis" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Récupérer le profil cible
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, user_id, prenom, nom")
      .eq("id", ownerId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: "Propriétaire non trouvé" }, { status: 404 });
    }

    // Récupérer le profil admin
    const { data: adminProfile } = await adminSupabase
      .from("profiles")
      .select("id, prenom, nom")
      .eq("user_id", user.id)
      .single();

    const adminName = adminProfile 
      ? `${adminProfile.prenom || ""} ${adminProfile.nom || ""}`.trim() || "Admin"
      : "Admin";

    // Exécuter l'action
    const now = new Date().toISOString();
    
    switch (action) {
      case "suspend":
        // Mettre à jour le profil
        await supabase
          .from("profiles")
          .update({
            account_status: "suspended",
            suspended_at: now,
            suspended_reason: reason,
          })
          .eq("id", ownerId);
        
        // Désactiver l'utilisateur auth (optionnel)
        if (targetProfile.user_id) {
          try {
            await supabase.auth.admin.updateUserById(targetProfile.user_id, {
              ban_duration: "876000h", // ~100 ans = ban effectif
            });
          } catch (e) {
            console.warn("Could not ban auth user:", e);
          }
        }
        break;

      case "unsuspend":
        await supabase
          .from("profiles")
          .update({
            account_status: "active",
            suspended_at: null,
            suspended_reason: null,
          })
          .eq("id", ownerId);
        
        if (targetProfile.user_id) {
          try {
            await supabase.auth.admin.updateUserById(targetProfile.user_id, {
              ban_duration: "none",
            });
          } catch (e) {
            console.warn("Could not unban auth user:", e);
          }
        }
        break;

      case "ban":
        await supabase
          .from("profiles")
          .update({
            account_status: "banned",
            suspended_at: now,
            suspended_reason: reason,
          })
          .eq("id", ownerId);
        
        if (targetProfile.user_id) {
          try {
            await supabase.auth.admin.updateUserById(targetProfile.user_id, {
              ban_duration: "876000h",
            });
          } catch (e) {
            console.warn("Could not ban auth user:", e);
          }
        }
        break;

      case "restrict":
        await supabase
          .from("profiles")
          .update({ account_status: "restricted" })
          .eq("id", ownerId);
        break;

      case "warn":
        // Envoyer une notification d'avertissement
        try {
          await supabase.from("notifications").insert({
            user_id: targetProfile.user_id,
            type: "warning",
            title: "Avertissement administratif",
            body: reason,
            is_read: false,
          });
        } catch (e) {
          console.warn("Could not send warning notification:", e);
        }
        break;
    }

    // Logger l'action dans audit_log
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: `moderation_${action}`,
      entity_type: "profile",
      entity_id: ownerId,
      metadata: {
        action,
        reason,
        target_name: `${targetProfile.prenom || ""} ${targetProfile.nom || ""}`.trim(),
        performed_by: adminName,
      },
    });

    // Essayer de logger dans moderation_actions si la table existe
    try {
      await supabase.from("moderation_actions").insert({
        target_profile_id: ownerId,
        action_type: action,
        reason,
        performed_by_id: adminProfile?.id,
        performed_by_name: adminName,
      });
    } catch {
      // Table doesn't exist
    }

    return NextResponse.json({
      success: true,
      message: `Action "${action}" effectuée avec succès`,
    });
  } catch (error: unknown) {
    console.error("[POST /api/admin/people/owners/[id]/moderation]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

