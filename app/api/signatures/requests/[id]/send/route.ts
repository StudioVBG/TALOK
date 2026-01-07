export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { sendSignatureRequestEmail } from "@/lib/services/email-service";

/**
 * POST /api/signatures/requests/[id]/send - Envoyer une demande de signature
 *
 * Système interne TALOK:
 * - Met à jour le statut de la demande
 * - Génère des tokens de signature pour chaque signataire
 * - Envoie des emails de notification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Utiliser service role
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Récupérer la demande de signature
    const { data: signatureRequest, error: fetchError } = await adminSupabase
      .from("signature_requests")
      .select(`
        *,
        signers:signature_request_signers(*),
        source_document:documents!source_document_id(id, title, storage_path)
      `)
      .eq("id", params.id)
      .single();

    if (fetchError || !signatureRequest) {
      return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 });
    }

    // Vérifier les permissions
    if (signatureRequest.owner_id !== profile.id && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Vérifier le statut
    if (signatureRequest.status !== "draft") {
      return NextResponse.json(
        { error: "Cette demande a déjà été envoyée" },
        { status: 400 }
      );
    }

    // Générer des tokens pour chaque signataire
    const signerTokens: { signerId: string; token: string }[] = [];

    for (const signer of signatureRequest.signers) {
      // Générer un token unique pour ce signataire
      const token = crypto.randomUUID();

      // Mettre à jour le signataire avec son token
      await adminSupabase
        .from("signature_request_signers")
        .update({
          signature_token: token,
          status: "notified",
          notified_at: new Date().toISOString(),
        })
        .eq("id", signer.id);

      signerTokens.push({ signerId: signer.id, token });

      // Envoyer l'email de notification
      try {
        await sendSignatureRequestEmail({
          to: signer.email,
          signerName: `${signer.first_name} ${signer.last_name}`,
          documentName: signatureRequest.name,
          senderName: `${profile.prenom} ${profile.nom}`,
          signatureUrl: `${process.env.NEXT_PUBLIC_APP_URL}/signature/${token}`,
          deadline: signatureRequest.deadline,
        });
      } catch (emailError) {
        console.error(`[Send] Email error for ${signer.email}:`, emailError);
        // Continuer même si l'email échoue
      }
    }

    // Mettre à jour le statut de la demande
    const { error: updateError } = await adminSupabase
      .from("signature_requests")
      .update({
        status: "pending",
        sent_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (updateError) {
      return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
    }

    // Audit log
    await adminSupabase.from("signature_audit_log").insert({
      signature_request_id: params.id,
      action: "request_sent",
      actor_profile_id: profile.id,
      details: {
        signers_notified: signatureRequest.signers.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Demande envoyée avec succès",
      signers_notified: signatureRequest.signers.length,
    });

  } catch (error: any) {
    console.error("[POST /api/signatures/requests/[id]/send] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
