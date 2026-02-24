export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { z } from "zod";

const acceptSchema = z.object({
  token: z.string().min(1, "Token requis"),
});

/**
 * POST /api/invitations/accept
 *
 * Accepte une invitation et lie le profil utilisateur au lease_signers.
 *
 * FIX P0-E4: Remplace l'ancienne logique côté client (markInvitationAsUsed)
 * - Exécution côté serveur avec service_role
 * - Vérification que l'email de l'utilisateur connecté correspond à l'invitation
 * - Liaison sécurisée du profile_id au lease_signers
 */
export async function POST(request: Request) {
  try {
    // 1. Authentifier l'utilisateur
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // 2. Valider le body
    const body = await request.json();
    const { token } = acceptSchema.parse(body);

    const serviceClient = getServiceClient();

    // 3. Récupérer le profil de l'utilisateur connecté
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role, email, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }
    const profileId = profile.id;
    if (!profileId) {
      return NextResponse.json(
        { error: "Profil invalide" },
        { status: 404 }
      );
    }

    // 4. Récupérer l'invitation par token
    const { data: invitation, error: invError } = await serviceClient
      .from("invitations")
      .select("id, email, lease_id, role, expires_at, used_at")
      .eq("token", token)
      .single();

    if (invError || !invitation) {
      return NextResponse.json(
        { error: "Invitation non trouvée" },
        { status: 404 }
      );
    }

    // 5. Vérifier que l'invitation n'est pas expirée
    if (new Date(invitation.expires_at as string) < new Date()) {
      return NextResponse.json(
        { error: "Cette invitation a expiré. Demandez un nouveau lien à votre propriétaire." },
        { status: 410 }
      );
    }

    // 6. Vérifier que l'invitation n'est pas déjà utilisée
    if (invitation.used_at) {
      return NextResponse.json(
        { error: "Cette invitation a déjà été utilisée." },
        { status: 409 }
      );
    }

    // 7. FIX P0-E4 CRITIQUE: Vérifier que l'email de l'utilisateur correspond
    const userEmail = (user.email || "").toLowerCase().trim();
    const invitationEmail = String(invitation.email ?? "").toLowerCase().trim();

    if (userEmail !== invitationEmail) {
      console.warn(
        `[accept-invitation] Email mismatch: user=${userEmail}, invitation=${invitationEmail}`
      );
      return NextResponse.json(
        {
          error: "L'email de votre compte ne correspond pas à l'invitation.",
          details: `Cette invitation est destinée à ${invitation.email}. Connectez-vous avec ce compte ou demandez une nouvelle invitation.`,
        },
        { status: 403 }
      );
    }

    // 8. Marquer l'invitation comme utilisée (update conditionnel : used_at null uniquement)
    const { data: updatedRows, error: updateError } = await serviceClient
      .from("invitations")
      .update({
        used_at: new Date().toISOString(),
        used_by: profileId,
      })
      .eq("id", invitation.id ?? "")
      .is("used_at", null) // Double protection contre race condition
      .select("id");

    if (updateError) {
      console.error("[accept-invitation] Erreur update invitation:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de l'acceptation de l'invitation" },
        { status: 500 }
      );
    }
    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        { error: "Cette invitation a déjà été utilisée." },
        { status: 409 }
      );
    }

    // 9. Lier le profile_id au lease_signers si un bail existe
    let leaseLinked = false;
    if (invitation.lease_id) {
      if (typeof invitation.lease_id !== "string") {
        throw new Error("Invalid invitation: lease_id is not a string");
      }
      const leaseId: string = invitation.lease_id;

      const { data: updatedSigners, error: signerError } = await serviceClient
        .from("lease_signers")
        .update({ profile_id: profileId })
        .eq("lease_id", leaseId)
        .ilike("invited_email", invitationEmail)
        .is("profile_id", null)
        .select("id");

      if (signerError) {
        console.error("[accept-invitation] Erreur liaison lease_signers:", signerError);
      } else {
        leaseLinked = (updatedSigners?.length || 0) > 0;
        if (leaseLinked) {
          console.log(
            `[accept-invitation] Profile ${profile.id} lié au lease_signers pour bail ${leaseId}`
          );
        }
      }

      // 10. Lier aussi dans roommates si colocation
      const { error: roommateError } = await serviceClient
        .from("roommates")
        .update({
          user_id: user.id,
          invitation_status: "accepted",
        })
        .eq("lease_id", leaseId)
        .ilike("invited_email", String(invitationEmail))
        .is("user_id", null);

      if (roommateError) {
        console.warn("[accept-invitation] Roommate update échoué (normal si pas coloc):", roommateError.message);
      }

      // 10b. Notifier le propriétaire quand un locataire accepte l'invitation
      if (leaseLinked) {
        try {
          const { data: leaseRow } = await serviceClient
            .from("leases")
            .select("property_id")
            .eq("id", leaseId)
            .single();
          const propertyId = leaseRow?.property_id;
          if (typeof propertyId !== "string") {
            throw new Error("Lease has no property_id");
          }

          const { data: propertyRow } = await serviceClient
            .from("properties")
            .select("owner_id")
            .eq("id", propertyId)
            .single();
          const ownerId = propertyRow?.owner_id;
          if (ownerId) {
            const tenantName = [profile?.prenom, profile?.nom].filter(Boolean).join(" ") || user.email || "Un locataire";
            await serviceClient.rpc("create_notification", {
              p_recipient_id: ownerId,
              p_type: "tenant_invitation_accepted",
              p_title: "Invitation acceptée",
              p_message: `${tenantName} a accepté l'invitation et est maintenant lié au bail.`,
              p_link: "/owner/tenants",
              p_related_id: leaseId,
              p_related_type: "lease",
            });
          }
        } catch (notifErr) {
          console.warn("[accept-invitation] Notification propriétaire non-bloquante:", notifErr);
        }
      }
    }

    // 11. Audit log (user_id = auth user id, pas profile_id)
    try {
      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        action: "invitation_accepted",
        entity_type: "invitation",
        entity_id: invitation.id ?? "",
        metadata: {
          lease_id: invitation.lease_id,
          invitation_role: invitation.role,
          lease_linked: leaseLinked,
          email: invitationEmail,
        } as Record<string, unknown>,
      });
    } catch {
      // Audit log non bloquant
    }

    return NextResponse.json({
      success: true,
      lease_id: invitation.lease_id,
      lease_linked: leaseLinked,
      role: invitation.role,
      message: leaseLinked
        ? "Invitation acceptée. Vous êtes maintenant lié au bail."
        : "Invitation acceptée.",
    });
  } catch (error: unknown) {
    console.error("[accept-invitation] Erreur:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
