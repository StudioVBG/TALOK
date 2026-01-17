export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { createClient } from "@supabase/supabase-js";

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
        created_by_profile_id: profile.id,
      })
      .select()
      .single();

    if (docError) {
      console.error("[POST /api/documents/upload] Document creation error:", docError);
      // Nettoyer le fichier uploadé en cas d'erreur
      await serviceClient.storage.from("documents").remove([filePath]);
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

