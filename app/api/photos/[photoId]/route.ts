export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { photoUpdateSchema } from "@/lib/validations";

const PHOTOS_BUCKET = "property-photos";

export async function PATCH(
  request: Request,
  { params }: { params: { photoId: string } }
) {
  try {
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
    const validated = photoUpdateSchema.parse(body);

    if (
      validated.room_id === undefined &&
      validated.tag === undefined &&
      validated.is_main === undefined &&
      validated.ordre === undefined
    ) {
      return NextResponse.json(
        { error: "Aucune donnée à mettre à jour." },
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

    const profile = await fetchProfile(serviceClient, user.id);

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const photo = await fetchPhotoRecord(serviceClient, params.photoId);

    if (!photo) {
      return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });
    }

    const { property_id: propertyId } = photo;

    const property = await fetchProperty(serviceClient, propertyId);

    if (!property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const profileData = profile as any;
    const isAdmin = profileData.role === "admin";
    const isOwner = property.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier cette photo" },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (validated.room_id !== undefined) {
      if (validated.room_id) {
        const belongs = await roomBelongsToProperty(serviceClient, validated.room_id, propertyId);
        if (!belongs) {
          return NextResponse.json(
            { error: "La pièce spécifiée n'appartient pas à ce logement" },
            { status: 400 }
          );
        }
        updates.room_id = validated.room_id;
      } else {
        updates.room_id = null;
      }
    }

    if (validated.tag !== undefined) {
      updates.tag = validated.tag ?? null;
    }

    if (validated.is_main) {
      await serviceClient
        .from("photos")
        .update({ is_main: false })
        .eq("property_id", propertyId);
      updates.is_main = true;
    } else if (validated.is_main === false) {
      updates.is_main = false;
    }

    const { data: updatedPhoto, error: updateError } = await serviceClient
      .from("photos")
      .update(updates as any)
      .eq("id", params.photoId)
      .select()
      .single();

    if (updateError || !updatedPhoto) {
      return NextResponse.json(
        { error: updateError?.message || "Impossible de mettre à jour la photo" },
        { status: 500 }
      );
    }

    if (validated.ordre !== undefined) {
      await reorderPhotos(serviceClient, propertyId, params.photoId, validated.ordre);
      const refreshed = await fetchPhotoRecord(serviceClient, params.photoId);
      return NextResponse.json({ photo: refreshed });
    }

    return NextResponse.json({ photo: updatedPhoto });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { photoId: string } }
) {
  try {
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

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const profile = await fetchProfile(serviceClient, user.id);

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const photo = await fetchPhotoRecord(serviceClient, params.photoId);

    if (!photo) {
      return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });
    }

    const property = await fetchProperty(serviceClient, photo.property_id);

    if (!property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const profileData = profile as any;
    const isAdmin = profileData.role === "admin";
    const isOwner = property.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de supprimer cette photo" },
        { status: 403 }
      );
    }

    const { error: deleteError } = await serviceClient
      .from("photos")
      .delete()
      .eq("id", params.photoId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message || "Impossible de supprimer la photo" },
        { status: 500 }
      );
    }

    if (photo.storage_path) {
      await serviceClient.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
    }

    if (photo.is_main) {
      await setFirstPhotoAsMain(serviceClient, photo.property_id);
    }

    await reorderPhotos(serviceClient, photo.property_id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

async function fetchProfile(serviceClient: any, userId: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", userId)
    .single();
  if (error) {
    return null;
  }
  return data;
}

async function fetchPhotoRecord(serviceClient: any, photoId: string) {
  const { data, error } = await serviceClient
    .from("photos")
    .select("id, property_id, room_id, tag, ordre, is_main, storage_path, url, updated_at")
    .eq("id", photoId)
    .single();
  if (error) {
    return null;
  }
  return data;
}

async function fetchProperty(serviceClient: any, propertyId: string) {
  const { data, error } = await serviceClient
    .from("properties")
    .select("id, owner_id")
    .eq("id", propertyId)
    .single();
  if (error) {
    return null;
  }
  return data;
}

async function roomBelongsToProperty(serviceClient: any, roomId: string, propertyId: string) {
  const { data } = await serviceClient
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .eq("property_id", propertyId)
    .maybeSingle();
  return !!data;
}

async function reorderPhotos(
  serviceClient: any,
  propertyId: string,
  targetPhotoId?: string,
  targetIndex?: number
) {
  const { data: photos } = await serviceClient
    .from("photos")
    .select("id, ordre")
    .eq("property_id", propertyId)
    .order("ordre", { ascending: true });

  if (!photos || photos.length === 0) {
    return;
  }

  const ordered = [...photos];

  if (targetPhotoId !== undefined && targetIndex !== undefined) {
    const currentIndex = ordered.findIndex((p) => p.id === targetPhotoId);
    if (currentIndex !== -1) {
      const [moved] = ordered.splice(currentIndex, 1);
      const safeIndex = Math.max(0, Math.min(targetIndex, ordered.length));
      ordered.splice(safeIndex, 0, moved);
    }
  }

  await Promise.all(
    ordered.map((photo, index) =>
      serviceClient
        .from("photos")
        .update({ ordre: index })
        .eq("id", photo.id)
    )
  );
}

async function setFirstPhotoAsMain(serviceClient: any, propertyId: string) {
  const { data: firstPhoto } = await serviceClient
    .from("photos")
    .select("id")
    .eq("property_id", propertyId)
    .order("ordre", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstPhoto) {
    await serviceClient
      .from("photos")
      .update({ is_main: true })
      .eq("id", firstPhoto.id);
  }
}
