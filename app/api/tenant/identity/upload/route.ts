export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/tenant/identity/upload
 * Upload de CNI pour le renouvellement (locataire authentifié)
 */
export async function POST(request: Request) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const serviceClient = getServiceClient();
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer les données du formulaire
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const side = formData.get("side") as string; // 'recto' ou 'verso'
    const leaseId = formData.get("lease_id") as string;
    const isRenewal = formData.get("is_renewal") === "true";
    const ocrDataRaw = formData.get("ocr_data") as string | null;
    const manualExpiryDateRaw = formData.get("manual_expiry_date") as string | null;

    if (!file || !side || !leaseId) {
      return NextResponse.json(
        { error: "Fichier, côté et bail requis" },
        { status: 400 }
      );
    }

    // Vérifier que le locataire est bien signataire de ce bail
    // Chercher d'abord par profile_id (cas nominal)
    let { data: signer } = await serviceClient
      .from("lease_signers")
      .select("id, profile_id")
      .eq("lease_id", leaseId)
      .eq("profile_id", profile.id)
      .in("role", ["locataire_principal", "colocataire"])
      .maybeSingle();

    // Fallback : chercher par invited_email (cas orphelin profile_id NULL)
    if (!signer && user.email) {
      const { data: signerByEmail } = await serviceClient
        .from("lease_signers")
        .select("id, profile_id")
        .eq("lease_id", leaseId)
        .ilike("invited_email", user.email)
        .in("role", ["locataire_principal", "colocataire"])
        .maybeSingle();

      if (signerByEmail) {
        // Auto-lier le profil si pas encore fait
        if (!signerByEmail.profile_id) {
          await serviceClient
            .from("lease_signers")
            .update({ profile_id: profile.id })
            .eq("id", signerByEmail.id);
          console.log(`[Upload CNI] Auto-link: signer ${signerByEmail.id} -> profile ${profile.id}`);
        }
        signer = signerByEmail;
      }
    }

    if (!signer) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à modifier ce bail" },
        { status: 403 }
      );
    }

    // 🔒 Récupérer owner_id et property_id via le bail pour la visibilité
    const { data: leaseWithProperty } = await serviceClient
      .from("leases")
      .select(`
        id,
        property_id,
        properties!inner(owner_id)
      `)
      .eq("id", leaseId)
      .single();

    if (!leaseWithProperty) {
      return NextResponse.json(
        { error: "Bail non trouvé ou vous n'avez pas accès à ce bail" },
        { status: 404 }
      );
    }

    const propertyId = leaseWithProperty.property_id ?? null;
    const ownerId = (leaseWithProperty.properties as { owner_id?: string } | null)?.owner_id ?? null;

    // Vérifier le type de fichier
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé" },
        { status: 400 }
      );
    }

    // Vérifier la taille (max 10 Mo)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 10 Mo)" },
        { status: 400 }
      );
    }

    // Parser les données OCR
    let ocrData: Record<string, any> = {};
    if (ocrDataRaw) {
      try {
        ocrData = JSON.parse(ocrDataRaw);
      } catch {}
    }

    // 🔄 TOUJOURS archiver les anciennes CNI du même type (éviter doublons)
    const docType = side === "recto" ? "cni_recto" : "cni_verso";
    
    // Trouver les anciennes CNI non archivées
    const { data: existingDocs } = await serviceClient
      .from("documents")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("type", docType)
      .eq("is_archived", false);

    if (existingDocs && existingDocs.length > 0) {
      console.log(`[Upload CNI] Archivage de ${existingDocs.length} ancien(s) document(s) ${docType}`);
      
      // Archiver toutes les anciennes
      await serviceClient
        .from("documents")
        .update({ is_archived: true })
        .eq("lease_id", leaseId)
        .eq("type", docType)
        .eq("is_archived", false);
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const fileName = `cni_${side}_${leaseId}_${timestamp}.${extension}`;
    const filePath = `leases/${leaseId}/identity/${fileName}`;

    // Convertir le fichier en buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload vers le bucket "documents"
    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Upload CNI] Erreur:", uploadError);
      return NextResponse.json(
        { error: "Erreur lors de l'upload" },
        { status: 500 }
      );
    }

    // Parser la date d'expiration (OCR puis fallback saisie manuelle)
    let expiryDate: string | null = null;
    if (ocrData.date_expiration) {
      const dateMatch = ocrData.date_expiration.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateMatch) {
        expiryDate = ocrData.date_expiration;

        // Vérifier que la CNI n'est pas déjà expirée
        const expiryDateObj = new Date(expiryDate + "T12:00:00Z");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiryDateObj < today) {
          return NextResponse.json(
            { error: "Ce document d'identité est expiré. Veuillez fournir un document en cours de validité." },
            { status: 400 }
          );
        }
      }
    }
    if (!expiryDate && manualExpiryDateRaw && typeof manualExpiryDateRaw === "string") {
      const trimmed = manualExpiryDateRaw.trim();
      const manualMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (manualMatch) {
        const manualDateObj = new Date(trimmed + "T12:00:00Z");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (manualDateObj >= today) {
          expiryDate = trimmed;
        } else {
          return NextResponse.json(
            { error: "La date d'expiration saisie est déjà passée." },
            { status: 400 }
          );
        }
      }
    }

    // Créer le document en base
    const sideLabel = side === "recto" ? "Recto" : "Verso";
    const tenantName = ocrData.prenom && ocrData.nom 
      ? `${ocrData.prenom} ${ocrData.nom}` 
      : null;
    const docTitle = tenantName 
      ? `CNI ${sideLabel} - ${tenantName}`
      : `Carte d'Identité (${sideLabel})`;
      
    const { data: newDoc, error: docError } = await serviceClient
      .from("documents")
      .insert({
        type: side === "recto" ? "cni_recto" : "cni_verso",
        title: docTitle,
        lease_id: leaseId,
        property_id: propertyId,
        owner_id: ownerId,
        tenant_id: profile.id,
        uploaded_by: profile.id,
        storage_path: filePath,
        expiry_date: expiryDate,
        verification_status: "pending",
        is_archived: false,
        metadata: {
          nom: ocrData.nom || null,
          prenom: ocrData.prenom || null,
          date_expiration: ocrData.date_expiration || null,
          ocr_confidence: ocrData.ocr_confidence || 0,
          tenant_email: user.email || null,
          uploaded_at: new Date().toISOString(),
          file_size: file.size,
          file_type: file.type,
          is_renewal: isRenewal,
        },
      })
      .select()
      .single();

    if (docError) {
      console.error("[Upload CNI] Erreur DB:", docError);
      return NextResponse.json(
        {
          error: `Erreur lors de l'enregistrement: ${docError.message}`,
          code: docError.code,
          hint: docError.hint ?? undefined,
        },
        { status: 500 }
      );
    }

    // 🔗 Mettre à jour les anciens docs avec le lien vers le nouveau
    if (newDoc && existingDocs && existingDocs.length > 0) {
      await serviceClient
        .from("documents")
        .update({ replaced_by: newDoc.id })
        .eq("lease_id", leaseId)
        .eq("type", docType)
        .eq("is_archived", true)
        .is("replaced_by", null);
    }

    // SOTA 2026: Synchroniser tenant_profiles pour débloquer la signature EDL
    // (la route /api/edl/[id]/sign vérifie tenant_profiles.cni_number)
    if (newDoc) {
      const cniNumber =
        (ocrData.numero_cni as string)?.trim() ||
        (ocrData.numero as string)?.trim() ||
        (ocrData.numero_document as string)?.trim() ||
        `CNI_UPLOADED_${newDoc.id}`;

      if (side === "recto") {
        await serviceClient
          .from("tenant_profiles")
          .upsert(
            {
              profile_id: profile.id,
              cni_number: cniNumber,
              cni_recto_path: filePath,
              cni_expiry_date: expiryDate,
              cni_verified_at: new Date().toISOString(),
              cni_verification_method: "ocr_scan",
              kyc_status: "verified",
              nb_adultes: 1,
              nb_enfants: 0,
              garant_required: false,
            },
            { onConflict: "profile_id" }
          );
      } else if (side === "verso") {
        await serviceClient
          .from("tenant_profiles")
          .update({ cni_verso_path: filePath })
          .eq("profile_id", profile.id);
      }
    }

    console.log("[Upload CNI] Succès:", newDoc?.id, "renewal:", isRenewal);

    return NextResponse.json({
      success: true,
      document_id: newDoc?.id,
      file_path: filePath,
      side,
      is_renewal: isRenewal,
    });

  } catch (error: unknown) {
    console.error("[Upload CNI] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

