export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import {
  createSignatureRequest as createYousignRequest,
  addDocument,
  addSigner,
  activateSignatureRequest,
  getDefaultSignaturePositions,
} from "@/lib/yousign/service";
import type { CreateSignerDTO } from "@/lib/yousign/types";

/**
 * POST /api/signatures/requests/[id]/send - Envoyer la demande aux signataires via Yousign
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Récupérer la demande avec signataires et document
    const { data: signatureRequest } = await adminSupabase
      .from("signature_requests")
      .select(`
        *,
        signers:signature_request_signers(*),
        source_document:documents!source_document_id(id, title, storage_path)
      `)
      .eq("id", params.id)
      .single();

    if (!signatureRequest) {
      return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 });
    }

    // Vérifier les permissions
    if (signatureRequest.owner_id !== profile.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Vérifier le statut
    const allowedStatuses = ["draft", "validated"];
    if (!allowedStatuses.includes(signatureRequest.status)) {
      return NextResponse.json(
        { error: `Impossible d'envoyer une demande en statut '${signatureRequest.status}'` },
        { status: 400 }
      );
    }

    // Vérifier la validation si requise
    if (signatureRequest.validation_required && signatureRequest.status !== "validated") {
      return NextResponse.json(
        { error: "Cette demande nécessite une validation avant envoi" },
        { status: 400 }
      );
    }

    const signers = signatureRequest.signers as any[];
    if (!signers || signers.length === 0) {
      return NextResponse.json(
        { error: "Aucun signataire défini" },
        { status: 400 }
      );
    }

    const sourceDoc = signatureRequest.source_document as any;
    if (!sourceDoc?.storage_path) {
      return NextResponse.json(
        { error: "Document source non disponible" },
        { status: 400 }
      );
    }

    // ========================================
    // ÉTAPE 1: Créer la procédure Yousign
    // ========================================
    console.log("[send] Création procédure Yousign...");
    
    let yousignProcedure;
    try {
      yousignProcedure = await createYousignRequest({
        name: signatureRequest.name,
        externalId: signatureRequest.id,
        orderedSigners: signatureRequest.ordered_signers,
        reminderSettings: signatureRequest.reminder_interval_days ? {
          intervalInDays: signatureRequest.reminder_interval_days,
          maxOccurrences: 3,
        } : undefined,
        expirationDate: signatureRequest.deadline,
      });
    } catch (yousignError: any) {
      console.error("[send] Erreur création Yousign:", yousignError);
      
      // Fallback: mode simulation si Yousign non configuré
      if (yousignError.message?.includes("YOUSIGN_API_KEY") || !process.env.YOUSIGN_API_KEY) {
        console.log("[send] Mode simulation (Yousign non configuré)");
        
        // Mettre à jour directement en mode simulation
        await adminSupabase
          .from("signature_requests")
          .update({
            status: "ongoing",
            sent_at: new Date().toISOString(),
            yousign_procedure_id: `sim_${Date.now()}`,
          })
          .eq("id", params.id);

        // Notifier les signataires (simulation)
        for (const signer of signers) {
          await adminSupabase
            .from("signature_request_signers")
            .update({
              status: "notified",
              notified_at: new Date().toISOString(),
            })
            .eq("id", signer.id);

          // Créer notification si signataire a un profil
          if (signer.profile_id) {
            await adminSupabase.from("notifications").insert({
              profile_id: signer.profile_id,
              type: "signature_requested",
              title: "Document à signer",
              message: `Vous avez un document "${signatureRequest.name}" à signer.`,
              data: { signature_request_id: params.id },
            });
          }
        }

        await adminSupabase.from("signature_audit_log").insert({
          signature_request_id: params.id,
          action: "sent_simulation",
          actor_profile_id: profile.id,
          details: { signers_count: signers.length, mode: "simulation" },
        });

        return NextResponse.json({
          success: true,
          status: "ongoing",
          mode: "simulation",
          message: "Demande envoyée en mode simulation (Yousign non configuré)",
        });
      }
      
      throw yousignError;
    }

    // ========================================
    // ÉTAPE 2: Ajouter le document
    // ========================================
    console.log("[send] Ajout document...");
    
    // Télécharger le document depuis Supabase Storage
    const { data: fileData, error: fileError } = await adminSupabase.storage
      .from("documents")
      .download(sourceDoc.storage_path);

    if (fileError || !fileData) {
      throw new Error("Impossible de récupérer le document source");
    }

    const documentBuffer = Buffer.from(await fileData.arrayBuffer());
    const documentBase64 = documentBuffer.toString("base64");
    
    const yousignDocument = await addDocument(
      yousignProcedure.id,
      documentBase64,
      sourceDoc.title || "document.pdf"
    );

    // ========================================
    // ÉTAPE 3: Ajouter les signataires
    // ========================================
    console.log("[send] Ajout signataires...");
    
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      
      const signerDTO: CreateSignerDTO = {
        profile_id: signer.profile_id,
        email: signer.email,
        first_name: signer.first_name,
        last_name: signer.last_name,
        phone: signer.phone,
        role: signer.role,
        signing_order: signer.signing_order,
        signature_level: signer.signature_level,
      };

      const fields = getDefaultSignaturePositions(
        yousignDocument.id!,
        i,
        signers.length
      );

      const yousignSigner = await addSigner(
        yousignProcedure.id,
        signerDTO,
        yousignDocument.id!,
        fields
      );

      // Mettre à jour le signataire avec l'ID Yousign
      await adminSupabase
        .from("signature_request_signers")
        .update({ yousign_signer_id: yousignSigner.id })
        .eq("id", signer.id);
    }

    // ========================================
    // ÉTAPE 4: Activer la procédure
    // ========================================
    console.log("[send] Activation procédure...");
    
    await activateSignatureRequest(yousignProcedure.id);

    // ========================================
    // ÉTAPE 5: Mettre à jour la demande
    // ========================================
    await adminSupabase
      .from("signature_requests")
      .update({
        status: "ongoing",
        sent_at: new Date().toISOString(),
        yousign_procedure_id: yousignProcedure.id,
      })
      .eq("id", params.id);

    // Mettre à jour les statuts des signataires
    await adminSupabase
      .from("signature_request_signers")
      .update({
        status: "notified",
        notified_at: new Date().toISOString(),
      })
      .eq("signature_request_id", params.id);

    // Audit log
    await adminSupabase.from("signature_audit_log").insert({
      signature_request_id: params.id,
      action: "sent",
      actor_profile_id: profile.id,
      details: {
        yousign_procedure_id: yousignProcedure.id,
        signers_count: signers.length,
      },
    });

    // Notifier les signataires internes
    for (const signer of signers) {
      if (signer.profile_id) {
        await adminSupabase.from("notifications").insert({
          profile_id: signer.profile_id,
          type: "signature_requested",
          title: "Document à signer",
          message: `Vous avez reçu un document "${signatureRequest.name}" à signer. Vérifiez votre email.`,
          data: { signature_request_id: params.id },
        });
      }
    }

    console.log("[send] Procédure envoyée avec succès");

    return NextResponse.json({
      success: true,
      status: "ongoing",
      yousign_procedure_id: yousignProcedure.id,
    });
  } catch (error: any) {
    console.error("[POST /api/signatures/requests/[id]/send] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

