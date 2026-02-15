export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { createClient } from "@supabase/supabase-js";
import { STORAGE_BUCKETS } from "@/lib/config/storage-buckets";
import { validateFile, ALLOWED_MIME_TYPES } from "@/lib/security/file-validation";

/**
 * POST /api/documents/upload - Upload un document
 * Route de compatibilité pour les anciens appels
 */
export async function POST(request: Request) {
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

    // Vérifier que la propriété appartient bien à l'utilisateur (si property_id fourni)
    if (propertyId && profileAny.role === "owner") {
      const { data: property } = await serviceClient
        .from("properties")
        .select("id, owner_id")
        .eq("id", propertyId)
        .single();

      if (!property || (property as any).owner_id !== profileAny.id) {
        return NextResponse.json(
          { error: "Ce bien ne vous appartient pas" },
          { status: 403 }
        );
      }
    }

    // Créer un nom de fichier unique
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = propertyId 
      ? `properties/${propertyId}/${fileName}`
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

    // Créer l'entrée dans la table documents
    const { data: document, error: docError } = await serviceClient
      .from("documents")
      .insert({
        property_id: propertyId || null,
        lease_id: leaseId || null,
        type: type || "autre",
        storage_path: filePath,
        created_by_profile_id: profileAny.id,
        owner_id: profileAny.role === "owner" ? profileAny.id : null,
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
}

