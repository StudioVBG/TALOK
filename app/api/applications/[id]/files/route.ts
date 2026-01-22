export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";

/**
 * POST /api/applications/[id]/files - Uploader un fichier pour une application
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Rate limiting pour les uploads
    const limiter = getRateLimiterByUser(rateLimitPresets.upload);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Trop de requêtes. Veuillez réessayer plus tard.",
          resetAt: limitResult.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitPresets.upload.maxRequests.toString(),
            "X-RateLimit-Remaining": limitResult.remaining.toString(),
            "X-RateLimit-Reset": limitResult.resetAt.toString(),
          },
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const kind = formData.get("kind") as string;

    if (!file || !kind) {
      return NextResponse.json(
        { error: "Fichier et type requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'application appartient à l'utilisateur
    const { data: application, error: appError } = await supabase
      .from("tenant_applications")
      .select("id, tenant_user")
      .eq("id", id as any)
      .single();

    if (appError || !application || !("tenant_user" in application)) {
      return NextResponse.json(
        { error: "Application non trouvée" },
        { status: 404 }
      );
    }

    if ((application as any).tenant_user !== user.id) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    // Calculer le hash SHA256
    const fileBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256 = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Upload vers Supabase Storage
    const fileName = `applications/${id}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Créer l'enregistrement
    const { data: fileRecord, error } = await supabase
      .from("application_files")
      .insert({
        application_id: id,
        kind,
        storage_path: uploadData.path,
        sha256,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      } as any)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ file: fileRecord });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

