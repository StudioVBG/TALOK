export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { photoUploadRequestSchema } from "@/lib/validations";

const PHOTOS_BUCKET = "property-photos";
const ROOMLESS_ALLOWED_TAGS = new Set(["vue_generale", "exterieur"]);

/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante (service role)" },
        { status: 500 }
      );
    }

    const body = await request.json();
    
    // Validation avec gestion d'erreur détaillée
    let validated;
    try {
      validated = photoUploadRequestSchema.parse(body);
    } catch (validationError: any) {
      console.error("[upload-url] Erreur de validation:", {
        body,
        errors: validationError.errors,
      });
      return NextResponse.json(
        { 
          error: "Données invalides", 
          details: validationError.errors,
          message: validationError.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const { data: property, error: propertyError } = await serviceClient
      .from("properties")
      .select("id, owner_id, type")
      .eq("id", id as any)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const profileData = profile as any;
    const isAdmin = profileData.role === "admin";
    const isOwner = property.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission d'ajouter des photos" },
        { status: 403 }
      );
    }

    // Déterminer le type de bien pour adapter les validations
    const propertyType = property.type as string;
    const isHabitation = ["appartement", "maison", "studio", "colocation"].includes(propertyType);
    const isParking = ["parking", "box"].includes(propertyType);
    const isLocal = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(propertyType);

    // Pour parking et locaux, les photos sans pièce sont autorisées avec des tags spécifiques
    const allowedTagsForParkingLocal = new Set(["vue_generale", "exterieur", "interieur", "detail"]);
    
    // Validation selon le type de bien
    if (!validated.room_id) {
      // Photo sans pièce
      if (isHabitation) {
        // Pour habitation, les photos sans pièce doivent avoir un tag spécifique
        if (!validated.tag || !ROOMLESS_ALLOWED_TAGS.has(validated.tag)) {
          return NextResponse.json(
            {
              error:
                "Les photos sans pièce doivent être marquées comme vue générale ou extérieure.",
            },
            { status: 400 }
          );
        }
      } else if (isParking || isLocal) {
        // Pour parking/locaux, les photos sans pièce sont autorisées avec des tags spécifiques
        if (!validated.tag || !allowedTagsForParkingLocal.has(validated.tag)) {
          return NextResponse.json(
            {
              error:
                "Les photos sans pièce doivent être marquées avec un tag valide (vue générale, extérieur, intérieur, détail).",
            },
            { status: 400 }
          );
        }
      }
    }

    if (validated.room_id) {
      const { data: room, error: roomError } = await serviceClient
        .from("rooms")
        .select("id")
        .eq("id", validated.room_id)
        .eq("property_id", id)
        .single();

      if (roomError || !room) {
        return NextResponse.json(
          { error: "La pièce associée est introuvable pour ce logement" },
          { status: 400 }
        );
      }
    }

    const { data: lastPhoto } = await serviceClient
      .from("photos")
      .select("ordre")
      .eq("property_id", id)
      .order("ordre", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: hasMain } = await serviceClient
      .from("photos")
      .select("id")
      .eq("property_id", id)
      .eq("is_main", true)
      .limit(1);

    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extMap[validated.mime_type];

    const photoId = randomUUID();
    const storagePath = `${id}/${photoId}.${extension}`;

    const { data: signedUpload, error: signedError } = await serviceClient.storage
      .from(PHOTOS_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (signedError || !signedUpload) {
      return NextResponse.json(
        { error: signedError?.message || "Impossible de générer l'URL d'upload" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = serviceClient.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath);

    const { data: insertedPhoto, error: insertError } = await serviceClient
      .from("photos")
      .insert({
        id: photoId,
        property_id: id,
        room_id: validated.room_id ?? null,
        url: publicUrl,
        storage_path: storagePath,
        tag: validated.tag ?? null,
        ordre: (lastPhoto?.ordre ?? -1) + 1,
        is_main: hasMain && hasMain.length > 0 ? false : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !insertedPhoto) {
      return NextResponse.json(
        { error: insertError?.message || "Impossible d'enregistrer la photo" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      upload_url: signedUpload.signedUrl,
      photo: insertedPhoto,
    });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { 
          error: "Données invalides", 
          details: error.errors,
          message: error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      );
    }
    console.error("[upload-url] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
