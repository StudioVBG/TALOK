export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { createClient } from "@supabase/supabase-js";
import { STORAGE_BUCKETS } from "@/lib/config/storage-buckets";
import { validateFile } from "@/lib/security/file-validation";
import { DOCUMENT_TYPES, ALLOWED_MIME_TYPES } from "@/lib/documents/constants";
import { withSecurity } from "@/lib/api/with-security";
import { withSubscriptionLimit, createSubscriptionErrorResponse } from "@/lib/middleware/subscription-check";
import { tesseractOCRService } from "@/lib/ocr/tesseract.service";
import { getDisplayName } from "@/lib/documents/format-name";

/**
 * POST /api/documents/upload - Upload un document
 * Route de compatibilité pour les anciens appels
 */
export const POST = withSecurity(async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const propertyId = formData.get("property_id") as string | null;
    const leaseId = formData.get("lease_id") as string | null;
    const type = formData.get("type") as string | null;
    if (type && !(DOCUMENT_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: `Type de document invalide: ${type}` }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    // Validation MIME type et taille du fichier
    const fileValidation = validateFile(file, {
      allowedMimeTypes: [
        ...ALLOWED_MIME_TYPES.documents,
        ...ALLOWED_MIME_TYPES.images,
        ...ALLOWED_MIME_TYPES.spreadsheets,
      ] as string[],
    });
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: fileValidation.error, code: fileValidation.code },
        { status: 400 }
      );
    }

    // Rediriger vers la route upload-batch pour le traitement
    // ou implémenter la logique d'upload ici
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante" },
        { status: 500 }
      );
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Récupérer le profil
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier que le rôle est autorisé à uploader
    const profileAny = profile as any;
    if (!["owner", "tenant", "admin"].includes(profileAny.role)) {
      return NextResponse.json({ error: "Rôle non autorisé" }, { status: 403 });
    }

    // Variables mutables pour résolution automatique
    let resolvedPropertyId = propertyId;
    let resolvedLeaseId = leaseId;
    let resolvedOwnerId: string | null = profileAny.role === "owner" ? profileAny.id : null;

    // Résoudre l'entity_id depuis la propriété ou le bail
    let resolvedEntityId: string | null = null;

    // Vérifier que la propriété appartient bien à l'utilisateur (si property_id fourni)
    if (resolvedPropertyId && profileAny.role === "owner") {
      const { data: property } = await serviceClient
        .from("properties")
        .select("id, owner_id, legal_entity_id")
        .eq("id", resolvedPropertyId)
        .single();

      if (!property || (property as any).owner_id !== profileAny.id) {
        return NextResponse.json(
          { error: "Ce bien ne vous appartient pas" },
          { status: 403 }
        );
      }
      resolvedEntityId = (property as any).legal_entity_id || null;
    }

    // ✅ AUTO-RESOLVE: Pour les locataires, résoudre property_id et lease_id
    // depuis leurs baux si non fournis dans le formulaire
    if (profileAny.role === "tenant" && (!resolvedPropertyId || !resolvedLeaseId)) {
      try {
        const { data: signers } = await serviceClient
          .from("lease_signers")
          .select("lease_id, lease:leases(id, property_id, statut)")
          .eq("profile_id", profileAny.id);

        if (signers && signers.length > 0) {
          // Privilégier le bail actif
          const activeSigner = signers.find((s: any) => s.lease?.statut === "active") || signers[0];
          const signerLease = (activeSigner as any)?.lease;
          if (signerLease) {
            if (!resolvedLeaseId) resolvedLeaseId = signerLease.id;
            if (!resolvedPropertyId) resolvedPropertyId = signerLease.property_id;
          }
        }
      } catch (resolveErr) {
        console.error("[POST /api/documents/upload] Auto-resolve lease/property échoué:", resolveErr);
        // For tenants, lease association is important for document visibility
        if (!resolvedLeaseId && !resolvedPropertyId) {
          return NextResponse.json(
            { error: "Impossible de déterminer votre bail. Veuillez réessayer." },
            { status: 400 }
          );
        }
      }
    }

    // Résoudre owner_id pour les locataires (avant vérification limite)
    if (profileAny.role === "tenant" && resolvedPropertyId && !resolvedOwnerId) {
      const { data: prop } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", resolvedPropertyId)
        .maybeSingle();
      if (prop) resolvedOwnerId = (prop as any).owner_id;
    }

    if (resolvedOwnerId) {
      const limitCheck = await withSubscriptionLimit(resolvedOwnerId, "documents_gb");
      if (!limitCheck.allowed) {
        return createSubscriptionErrorResponse(limitCheck);
      }
    }

    // Créer un nom de fichier unique
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = resolvedPropertyId 
      ? `properties/${resolvedPropertyId}/${fileName}`
      : `documents/${fileName}`;

    // Upload vers Supabase Storage
    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("[POST /api/documents/upload] Upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Erreur lors de l'upload" },
        { status: 500 }
      );
    }

    // Résoudre entity_id depuis le bail si pas encore résolu
    if (!resolvedEntityId && resolvedLeaseId) {
      const { data: leaseForEntity } = await serviceClient
        .from("leases")
        .select("signatory_entity_id")
        .eq("id", resolvedLeaseId)
        .maybeSingle();
      if (leaseForEntity) {
        resolvedEntityId = (leaseForEntity as any).signatory_entity_id || null;
      }
    }
    // Fallback: résoudre depuis la propriété si toujours pas d'entity
    if (!resolvedEntityId && resolvedPropertyId) {
      const { data: propForEntity } = await serviceClient
        .from("properties")
        .select("legal_entity_id")
        .eq("id", resolvedPropertyId)
        .maybeSingle();
      if (propForEntity) {
        resolvedEntityId = (propForEntity as any).legal_entity_id || null;
      }
    }

    // Créer l'entrée dans la table documents
    const documentInsert: Record<string, unknown> = {
      property_id: resolvedPropertyId || null,
      lease_id: resolvedLeaseId || null,
      type: type || "autre",
      title: getDisplayName(file.name, type),
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      storage_path: filePath,
      created_by_profile_id: profileAny.id,
      uploaded_by: profileAny.id,
      owner_id: resolvedOwnerId,
      tenant_id: profileAny.role === "tenant" ? profileAny.id : null,
      entity_id: resolvedEntityId,
    };

    // Garde-fou : un document auto-généré doit toujours être visible par le locataire
    if (documentInsert.is_generated) {
      documentInsert.visible_tenant = true;
    }

    const { data: document, error: docError } = await serviceClient
      .from("documents")
      .insert(documentInsert)
      .select()
      .single();

    if (docError) {
      console.error("[POST /api/documents/upload] Document creation error:", docError);
      // Nettoyer le fichier uploadé en cas d'erreur
      await serviceClient.storage.from(STORAGE_BUCKETS.DOCUMENTS).remove([filePath]);
      return NextResponse.json(
        { error: docError.message || "Erreur lors de la création du document" },
        { status: 500 }
      );
    }

    // OCR automatique pour les documents CNI (recto/verso)
    const isCniDocument = type && ["cni_recto", "cni_verso"].includes(type);
    const isImageFile = file.type.startsWith("image/");

    if (isCniDocument && isImageFile && document) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);
        const ocrResult = await tesseractOCRService.analyzeIdCard(imageBuffer, file.name);

        // Construire les metadata OCR
        const ocrMetadata: Record<string, unknown> = {
          ...(document as any).metadata,
          ocr_confidence: ocrResult.confidence,
          ocr_is_valid: ocrResult.isValid,
          ocr_document_type: ocrResult.documentType,
        };

        if (ocrResult.lastName) ocrMetadata.nom = ocrResult.lastName;
        if (ocrResult.firstName) ocrMetadata.prenom = ocrResult.firstName;
        if (ocrResult.documentNumber) ocrMetadata.numero_document = ocrResult.documentNumber;
        if (ocrResult.expiryDate) ocrMetadata.date_expiration = ocrResult.expiryDate;
        if (ocrResult.birthDate) ocrMetadata.date_naissance = ocrResult.birthDate;
        if (ocrResult.birthPlace) ocrMetadata.lieu_naissance = ocrResult.birthPlace;
        if (ocrResult.gender) ocrMetadata.sexe = ocrResult.gender;
        if (ocrResult.nationality) ocrMetadata.nationalite = ocrResult.nationality;
        if (ocrResult.requiresManualVerification) ocrMetadata.requires_manual_verification = true;

        // Comparaison avec le profil propriétaire si c'est un owner
        let identityMatch: Record<string, unknown> | null = null;
        if (profileAny.role === "owner") {
          const { data: ownerProfile } = await serviceClient
            .from("profiles")
            .select("nom, prenom")
            .eq("id", profileAny.id)
            .single();

          if (ownerProfile) {
            const normalize = (s: string | null | undefined) =>
              (s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-\s]+/g, " ").trim();

            const profileNom = normalize((ownerProfile as any).nom);
            const profilePrenom = normalize((ownerProfile as any).prenom);
            const ocrNom = normalize(ocrResult.lastName);
            const ocrPrenom = normalize(ocrResult.firstName);

            const nomMatch = profileNom && ocrNom ? profileNom === ocrNom : false;
            const prenomMatch = profilePrenom && ocrPrenom ? profilePrenom === ocrPrenom : false;

            identityMatch = {
              nom_match: nomMatch,
              prenom_match: prenomMatch,
              profile_nom: (ownerProfile as any).nom,
              profile_prenom: (ownerProfile as any).prenom,
              ocr_nom: ocrResult.lastName || null,
              ocr_prenom: ocrResult.firstName || null,
              is_verified: nomMatch && prenomMatch && ocrResult.isValid,
            };

            ocrMetadata.identity_match = identityMatch;
          }
        }

        // Déterminer le statut de vérification
        const verificationStatus = identityMatch?.is_verified
          ? "verified"
          : ocrResult.isValid
            ? "pending"
            : "pending";

        // Mettre à jour le document avec les données OCR
        await serviceClient
          .from("documents")
          .update({
            metadata: ocrMetadata,
            verification_status: verificationStatus,
          })
          .eq("id", (document as any).id);

        // Enrichir la réponse avec les données OCR
        (document as any).metadata = ocrMetadata;
        (document as any).verification_status = verificationStatus;

      } catch (ocrError) {
        // L'OCR est non-bloquant : si ça échoue, le document est quand même uploadé
        console.error("[POST /api/documents/upload] OCR processing failed (non-blocking):", ocrError);
      }
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/documents/upload] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}, { routeName: "POST /api/documents/upload", csrf: true });

