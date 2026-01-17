export const runtime = 'nodejs';

/**
 * API Route pour l'upload de documents garant
 * POST /api/guarantors/documents/upload
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { guarantorDocumentTypeEnum } from "@/lib/validations/guarantor";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier que le profil garant existe
    const { data: guarantorProfile } = await supabase
      .from("guarantor_profiles")
      .select("profile_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!guarantorProfile) {
      return NextResponse.json(
        { error: "Profil garant non trouvé. Créez d'abord votre profil." },
        { status: 404 }
      );
    }

    // Parser le formulaire
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentType = formData.get("document_type") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    }

    if (!documentType) {
      return NextResponse.json({ error: "Type de document requis" }, { status: 400 });
    }

    // Valider le type de document
    const typeValidation = guarantorDocumentTypeEnum.safeParse(documentType);
    if (!typeValidation.success) {
      return NextResponse.json({ error: "Type de document invalide" }, { status: 400 });
    }

    // Valider la taille
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 10MB)" },
        { status: 400 }
      );
    }

    // Valider le type MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé (PDF, JPEG, PNG, WebP)" },
        { status: 400 }
      );
    }

    // Générer le chemin de stockage
    const extension = file.name.split(".").pop() || "pdf";
    const timestamp = Date.now();
    const storagePath = `guarantors/${profile.id}/${documentType}_${timestamp}.${extension}`;

    // Convertir le fichier en buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Uploader vers Supabase Storage
    const serviceClient = createServiceRoleClient();
    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Erreur upload:", uploadError);
      return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 });
    }

    // Créer l'entrée en base
    const { data: document, error: dbError } = await serviceClient
      .from("guarantor_documents")
      .insert({
        guarantor_profile_id: profile.id,
        document_type: documentType,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
      })
      .select()
      .single();

    if (dbError) {
      // Supprimer le fichier uploadé en cas d'erreur
      await serviceClient.storage.from("documents").remove([storagePath]);
      console.error("Erreur création document:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(document, { status: 201 });
  } catch (error: unknown) {
    console.error("Erreur API upload document garant:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}







