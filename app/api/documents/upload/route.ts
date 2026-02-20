export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { createClient } from "@supabase/supabase-js";
import { STORAGE_BUCKETS } from "@/lib/config/storage-buckets";
import { validateFile, ALLOWED_MIME_TYPES } from "@/lib/security/file-validation";
import { withSecurity } from "@/lib/api/with-security";

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
    const allowedDocumentTypes = [
      "bail", "avenant", "engagement_garant", "bail_signe_locataire", "bail_signe_proprietaire",
      "piece_identite", "cni_recto", "cni_verso", "passeport", "titre_sejour",
      "quittance", "facture", "rib", "avis_imposition", "bulletin_paie", "attestation_loyer",
      "attestation_assurance", "assurance_pno",
      "diagnostic", "dpe", "diagnostic_gaz", "diagnostic_electricite", "diagnostic_plomb", "diagnostic_amiante", "diagnostic_termites", "erp",
      "EDL_entree", "EDL_sortie", "inventaire",
      "candidature_identite", "candidature_revenus", "candidature_domicile", "candidature_garantie",
      "garant_identite", "garant_revenus", "garant_domicile", "garant_engagement",
      "devis", "ordre_mission", "rapport_intervention",
      "taxe_fonciere", "taxe_sejour", "copropriete", "proces_verbal", "appel_fonds",
      "consentement", "courrier", "photo", "justificatif_revenus", "autre",
    ];
    if (type && !allowedDocumentTypes.includes(type)) {
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
      ],
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

    // Vérifier que la propriété appartient bien à l'utilisateur (si property_id fourni)
    if (resolvedPropertyId && profileAny.role === "owner") {
      const { data: property } = await serviceClient
        .from("properties")
        .select("id, owner_id")
        .eq("id", resolvedPropertyId)
        .single();

      if (!property || (property as any).owner_id !== profileAny.id) {
        return NextResponse.json(
          { error: "Ce bien ne vous appartient pas" },
          { status: 403 }
        );
      }
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
        console.warn("[POST /api/documents/upload] Auto-resolve lease/property échoué:", resolveErr);
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

    // ✅ Résoudre le owner_id quand c'est un locataire qui upload
    // (nécessaire pour que le propriétaire voie le document)
    let resolvedOwnerId: string | null = profileAny.role === "owner" ? profileAny.id : null;
    if (profileAny.role === "tenant" && resolvedPropertyId && !resolvedOwnerId) {
      try {
        const { data: prop } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", resolvedPropertyId)
          .single();
        if (prop) resolvedOwnerId = (prop as any).owner_id;
      } catch { /* non-bloquant */ }
    }

    // Créer l'entrée dans la table documents
    const { data: document, error: docError } = await serviceClient
      .from("documents")
      .insert({
        property_id: resolvedPropertyId || null,
        lease_id: resolvedLeaseId || null,
        type: type || "autre",
        storage_path: filePath,
        created_by_profile_id: profileAny.id,
        owner_id: resolvedOwnerId,
        tenant_id: profileAny.role === "tenant" ? profileAny.id : null,
      })
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

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/documents/upload] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}, { routeName: "POST /api/documents/upload", csrf: true });

