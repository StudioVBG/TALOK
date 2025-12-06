// @ts-nocheck
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

    if (!file || !side || !leaseId) {
      return NextResponse.json(
        { error: "Fichier, côté et bail requis" },
        { status: 400 }
      );
    }

    // Vérifier que le locataire est bien signataire de ce bail
    const { data: signer, error: signerError } = await serviceClient
      .from("lease_signers")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("profile_id", profile.id)
      .in("role", ["locataire_principal", "colocataire"])
      .single();

    if (signerError || !signer) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à modifier ce bail" },
        { status: 403 }
      );
    }

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

    // Si renouvellement, archiver l'ancienne CNI
    if (isRenewal) {
      const docType = side === "recto" ? "cni_recto" : "cni_verso";
      
      // Trouver l'ancienne CNI
      const { data: oldDoc } = await serviceClient
        .from("documents")
        .select("id")
        .eq("lease_id", leaseId)
        .eq("type", docType)
        .eq("is_archived", false)
        .single();

      if (oldDoc) {
        // Archiver l'ancienne
        await serviceClient
          .from("documents")
          .update({ is_archived: true })
          .eq("id", oldDoc.id);

        console.log(`[Renewal] Ancienne CNI ${docType} archivée:`, oldDoc.id);
      }
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

    // Parser la date d'expiration
    let expiryDate: string | null = null;
    if (ocrData.date_expiration) {
      const dateMatch = ocrData.date_expiration.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateMatch) expiryDate = ocrData.date_expiration;
    }

    // Créer le document en base
    const { data: newDoc, error: docError } = await serviceClient
      .from("documents")
      .insert({
        type: side === "recto" ? "cni_recto" : "cni_verso",
        lease_id: leaseId,
        tenant_id: profile.id,
        storage_path: filePath,
        expiry_date: expiryDate,
        verification_status: "pending",
        is_archived: false,
        metadata: {
          nom: ocrData.nom || null,
          prenom: ocrData.prenom || null,
          date_expiration: ocrData.date_expiration || null,
          ocr_confidence: ocrData.ocr_confidence || 0,
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
        { error: "Erreur lors de l'enregistrement" },
        { status: 500 }
      );
    }

    // Si ancienne CNI archivée, lier la nouvelle
    if (isRenewal && newDoc) {
      const docType = side === "recto" ? "cni_recto" : "cni_verso";
      
      const { data: archivedDoc } = await serviceClient
        .from("documents")
        .select("id")
        .eq("lease_id", leaseId)
        .eq("type", docType)
        .eq("is_archived", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (archivedDoc) {
        await serviceClient
          .from("documents")
          .update({ replaced_by: newDoc.id })
          .eq("id", archivedDoc.id);
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

  } catch (error: any) {
    console.error("[Upload CNI] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

