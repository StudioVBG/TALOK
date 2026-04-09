export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * API RGPD Suppression de compte — Article 17 (Droit à l'effacement)
 *
 * POST /api/rgpd/delete-account
 *
 * Flow:
 * 1. Vérifie qu'aucun bail actif n'existe
 * 2. Anonymise le profil (nom, email, téléphone)
 * 3. Supprime photos, push tokens, sessions
 * 4. Conserve factures/quittances (obligation légale 10 ans)
 * 5. Envoie email de confirmation
 * 6. Supprime l'utilisateur Supabase Auth
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const deleteAccountSchema = z.object({
  confirmation: z.literal("SUPPRIMER MON COMPTE"),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = deleteAccountSchema.parse(body);

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom, email")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileId = (profile as any).id;
    const role = (profile as any).role;

    // Admin cannot delete themselves
    if (role === "admin") {
      return NextResponse.json(
        { error: "Un administrateur ne peut pas supprimer son propre compte." },
        { status: 403 }
      );
    }

    // Check for active leases
    const { data: activeLeases } = await supabase
      .from("leases")
      .select("id")
      .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`)
      .eq("status", "active")
      .limit(1);

    if (activeLeases && activeLeases.length > 0) {
      return NextResponse.json(
        {
          error:
            "Vous avez un ou plusieurs baux actifs. Veuillez les résilier avant de supprimer votre compte.",
        },
        { status: 409 }
      );
    }

    // Record the deletion request
    await supabase.from("data_requests").insert({
      profile_id: profileId,
      request_type: "deletion",
      status: "processing",
      reason: "Self-service account deletion",
    } as any);

    const serviceClient = getServiceClient();
    const anonymizedEmail = `deleted_${Date.now()}@anonymized.talok.fr`;

    // Anonymize profile
    const { error: profileError } = await serviceClient
      .from("profiles")
      .update({
        prenom: "Utilisateur",
        nom: "supprimé",
        email: anonymizedEmail,
        telephone: null,
        avatar_url: null,
        date_naissance: null,
        lieu_naissance: null,
        nationalite: null,
        adresse: null,
        code_postal: null,
        ville: null,
        pays: null,
        account_status: "deleted",
      } as any)
      .eq("id", profileId);

    if (profileError) {
      console.error("[rgpd/delete-account] Profile anonymize error:", profileError);
      return NextResponse.json(
        { error: "Erreur lors de l'anonymisation du profil" },
        { status: 500 }
      );
    }

    // Anonymize role-specific profile
    if (role === "owner") {
      await serviceClient
        .from("owner_profiles")
        .update({
          company_name: null,
          siret: null,
          tva_number: null,
          iban: null,
          bic: null,
        } as any)
        .eq("profile_id", profileId);
    } else if (role === "tenant") {
      await serviceClient
        .from("tenant_profiles")
        .update({
          employer_name: null,
          employment_type: null,
          monthly_income: null,
        } as any)
        .eq("profile_id", profileId);
    } else if (role === "provider") {
      await serviceClient
        .from("provider_profiles")
        .update({
          company_name: null,
          siret: null,
        } as any)
        .eq("profile_id", profileId);
    }

    // Delete non-financial documents from storage
    const { data: documents } = await serviceClient
      .from("documents")
      .select("id, storage_path, type")
      .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`);

    if (documents && documents.length > 0) {
      const nonFinancialDocs = documents.filter(
        (d: any) => !["quittance", "facture", "invoice"].includes(d.type)
      );
      for (const doc of nonFinancialDocs) {
        try {
          if ((doc as any).storage_path) {
            await serviceClient.storage
              .from("documents")
              .remove([(doc as any).storage_path]);
          }
        } catch {
          // Continue on storage errors
        }
      }
    }

    // Delete identity documents
    const { data: identityDocs } = await serviceClient
      .from("tenant_identity_documents")
      .select("id, storage_path")
      .eq("tenant_id", profileId);

    if (identityDocs && identityDocs.length > 0) {
      for (const doc of identityDocs) {
        try {
          if ((doc as any).storage_path) {
            await serviceClient.storage
              .from("identity")
              .remove([(doc as any).storage_path]);
          }
        } catch {
          // Continue on storage errors
        }
      }
    }

    // Clear notifications
    await serviceClient
      .from("notifications")
      .delete()
      .eq("profile_id", profileId);

    // Clear push tokens
    await serviceClient
      .from("push_tokens" as any)
      .delete()
      .eq("profile_id", profileId);

    // Mark data request as completed
    await serviceClient
      .from("data_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() } as any)
      .eq("profile_id", profileId)
      .eq("request_type", "deletion")
      .eq("status", "processing");

    // Audit log
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "account_deleted_self_service",
      entity_type: "user",
      entity_id: user.id,
      metadata: {
        original_email: user.email,
        anonymized_email: anonymizedEmail,
        role,
      },
    } as any);

    // Send confirmation email before deleting auth user
    try {
      const { sendAccountDeletionConfirmation } = await import("@/lib/emails/resend.service");
      if (user.email) {
        await sendAccountDeletionConfirmation(user.email, (profile as any).prenom || "");
      }
    } catch {
      // Email failure should not block deletion
    }

    // Delete Supabase Auth user (this invalidates all sessions)
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("[rgpd/delete-account] Auth delete error:", deleteError);
      // Profile is already anonymized, so we continue
    }

    return NextResponse.json({
      success: true,
      message: "Votre compte a été supprimé et vos données anonymisées.",
    });
  } catch (error: unknown) {
    if ((error as any)?.name === "ZodError") {
      return NextResponse.json(
        { error: "Confirmation invalide" },
        { status: 400 }
      );
    }
    console.error("[rgpd/delete-account] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
