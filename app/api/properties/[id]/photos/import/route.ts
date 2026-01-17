export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 secondes max pour télécharger les images

interface ImportPhotoRequest {
  urls: string[];
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Configuration serveur manquante" },
        { status: 500 }
      );
    }

    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Vérifier que la propriété appartient à l'utilisateur
    const { data: property } = await serviceClient
      .from("properties")
      .select("id, owner_id")
      .eq("id", params.id)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    // Récupérer le profile_id de l'utilisateur
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile || property.owner_id !== profile.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body: ImportPhotoRequest = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "URLs manquantes" }, { status: 400 });
    }

    // Limiter à 10 photos par requête
    const urlsToProcess = urls.slice(0, 10);
    const results: { url: string; success: boolean; photoId?: string; error?: string }[] = [];

    // Récupérer le nombre actuel de photos pour l'ordre
    const { count: currentPhotoCount } = await serviceClient
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("property_id", params.id);

    let ordre = (currentPhotoCount || 0) + 1;

    for (const url of urlsToProcess) {
      try {
        console.log(`[ImportPhoto] Téléchargement: ${url}`);
        
        // Télécharger l'image
        const imageResponse = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PropertyManager/1.0)",
            "Accept": "image/*",
          },
        });

        if (!imageResponse.ok) {
          results.push({ url, success: false, error: `HTTP ${imageResponse.status}` });
          continue;
        }

        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        const imageBuffer = await imageResponse.arrayBuffer();
        
        // Vérifier la taille (max 5MB)
        if (imageBuffer.byteLength > 5 * 1024 * 1024) {
          results.push({ url, success: false, error: "Image trop volumineuse (>5MB)" });
          continue;
        }

        // Générer un nom de fichier unique
        const extension = contentType.includes("png") ? "png" 
          : contentType.includes("webp") ? "webp" 
          : "jpg";
        const fileName = `${params.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;

        // Upload vers Supabase Storage
        const { data: uploadData, error: uploadError } = await serviceClient
          .storage
          .from("property-photos")
          .upload(fileName, imageBuffer, {
            contentType,
            upsert: false,
          });

        if (uploadError) {
          console.error(`[ImportPhoto] Upload error:`, uploadError);
          results.push({ url, success: false, error: uploadError.message });
          continue;
        }

        // Récupérer l'URL publique
        const { data: publicUrlData } = serviceClient
          .storage
          .from("property-photos")
          .getPublicUrl(fileName);

        const publicUrl = publicUrlData?.publicUrl;

        // Insérer dans la table photos (sans colonne "source" qui n'existe pas)
        const { data: photoRecord, error: insertError } = await serviceClient
          .from("photos")
          .insert({
            property_id: params.id,
            url: publicUrl,
            storage_path: fileName,
            ordre: ordre,
            tag: "import", // Utiliser le tag pour identifier la source
            is_main: ordre === 1, // Première photo = principale
          })
          .select()
          .single();

        if (insertError) {
          console.error(`[ImportPhoto] Insert error:`, insertError);
          // Nettoyer le fichier uploadé
          await serviceClient.storage.from("property-photos").remove([fileName]);
          results.push({ url, success: false, error: insertError.message });
          continue;
        }

        ordre++;
        results.push({ url, success: true, photoId: photoRecord.id });
        console.log(`[ImportPhoto] ✅ Photo importée: ${photoRecord.id}`);

      } catch (err: any) {
        console.error(`[ImportPhoto] Error for ${url}:`, err);
        results.push({ url, success: false, error: err.message || "Erreur inconnue" });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[ImportPhoto] ${successCount}/${urlsToProcess.length} photos importées`);

    return NextResponse.json({
      success: true,
      imported: successCount,
      total: urlsToProcess.length,
      results,
    });

  } catch (error: unknown) {
    console.error("[ImportPhoto] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

