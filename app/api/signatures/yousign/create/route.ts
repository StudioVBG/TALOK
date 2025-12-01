// @ts-nocheck
/**
 * API Route: Créer une procédure de signature Yousign
 * POST /api/signatures/yousign/create
 * 
 * Crée une procédure de signature électronique pour un bail.
 * Intègre avec Yousign API v3.
 * 
 * Documentation: https://developers.yousign.com/
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  createSignatureRequest,
  addDocument,
  addSigner,
  activateSignatureRequest,
  getDefaultSignaturePositions,
} from "@/lib/yousign/service";
import { pdfService } from "@/lib/services/pdf.service";

interface CreateSignatureBody {
  leaseId: string;
  signers: Array<{
    profileId: string;
    role: "proprietaire" | "locataire_principal" | "colocataire" | "garant";
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }>;
  orderedSigners?: boolean;
  expirationDays?: number;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body: CreateSignatureBody = await request.json();
    const { leaseId, signers, orderedSigners = true, expirationDays = 30 } = body;

    if (!leaseId || !signers || signers.length === 0) {
      return NextResponse.json(
        { error: "leaseId et signers requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est propriétaire du bail
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent créer des signatures" },
        { status: 403 }
      );
    }

    // Récupérer le bail et vérifier la propriété
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        *,
        property:property_id (
          id,
          owner_id,
          adresse_complete
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const property = lease.property as any;
    if (property?.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas le propriétaire de ce bail" },
        { status: 403 }
      );
    }

    // Récupérer ou générer le PDF du bail
    let pdfUrl: string;
    let pdfBase64: string;

    const { data: draft } = await supabase
      .from("lease_drafts")
      .select("pdf_url")
      .eq("lease_id", leaseId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (draft?.pdf_url) {
      // Télécharger le PDF existant
      const response = await fetch(draft.pdf_url);
      const buffer = await response.arrayBuffer();
      pdfBase64 = Buffer.from(buffer).toString("base64");
      pdfUrl = draft.pdf_url;
    } else {
      // Générer un nouveau PDF
      const result = await pdfService.generateLeaseDocument({
        leaseId,
        typeBail: lease.type_bail,
        bailData: {},
        generatePDF: true,
      });

      if (!result.url) {
        throw new Error("Impossible de générer le PDF du bail");
      }

      const response = await fetch(result.url);
      const buffer = await response.arrayBuffer();
      pdfBase64 = Buffer.from(buffer).toString("base64");
      pdfUrl = result.url;
    }

    // Créer la procédure Yousign
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expirationDays);

    const signatureRequest = await createSignatureRequest({
      name: `Bail - ${property?.adresse_complete || leaseId}`,
      externalId: leaseId,
      orderedSigners,
      expirationDate: expirationDate.toISOString(),
      reminderSettings: {
        intervalInDays: 3,
        maxOccurrences: 5,
      },
    });

    // Ajouter le document
    const document = await addDocument(
      signatureRequest.id,
      pdfBase64,
      `Bail_${leaseId}.pdf`
    );

    // Ajouter les signataires
    const addedSigners = [];
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      
      // Calculer les positions de signature
      const fields = getDefaultSignaturePositions(document.id, i, signers.length);

      const addedSigner = await addSigner(
        signatureRequest.id,
        {
          first_name: signer.firstName,
          last_name: signer.lastName,
          email: signer.email,
          phone: signer.phone,
          signature_level: "electronic_signature",
        },
        document.id,
        fields
      );

      addedSigners.push({
        ...addedSigner,
        profileId: signer.profileId,
        role: signer.role,
      });

      // Créer une entrée signature dans notre BDD
      await supabase.from("signatures").insert({
        lease_id: leaseId,
        draft_id: draft?.id || null,
        signer_user: user.id,
        signer_profile_id: signer.profileId,
        level: "AES", // Advanced Electronic Signature via Yousign
        provider_ref: addedSigner.id,
        doc_hash: document.hash || "",
        provider_data: {
          signature_request_id: signatureRequest.id,
          document_id: document.id,
        },
      });
    }

    // Activer la procédure (envoyer les emails)
    await activateSignatureRequest(signatureRequest.id);

    // Mettre à jour le statut du bail
    await supabase
      .from("leases")
      .update({ statut: "pending_signature" })
      .eq("id", leaseId);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "signature_request_created",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        signature_request_id: signatureRequest.id,
        signers_count: signers.length,
        provider: "yousign",
      },
    });

    return NextResponse.json({
      success: true,
      signatureRequest: {
        id: signatureRequest.id,
        status: signatureRequest.status,
        expirationDate: signatureRequest.expiration_date,
      },
      document: {
        id: document.id,
        filename: document.filename,
      },
      signers: addedSigners.map((s) => ({
        id: s.id,
        profileId: s.profileId,
        role: s.role,
        status: s.status,
      })),
    });
  } catch (error: any) {
    console.error("Erreur création signature Yousign:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

