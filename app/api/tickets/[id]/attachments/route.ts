export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { validateFile, ALLOWED_MIME_TYPES } from "@/lib/security/file-validation";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/tickets/[id]/attachments - Joindre un fichier à un ticket
 * Accepte multipart/form-data avec champ "file".
 * Types autorisés : images (jpg, png, webp) et PDF. Max 10 MB par fichier.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const serviceClient = getServiceClient();
    const { data: ticket, error: ticketError } = await serviceClient
      .from("tickets")
      .select("id, property_id, created_by_profile_id")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket non trouvé" }, { status: 404 });
    }

    const ticketAny = ticket as { created_by_profile_id?: string; property_id?: string };
    const isCreator = ticketAny.created_by_profile_id === profile.id;
    if (!isCreator && profile.role !== "admin" && profile.role !== "owner") {
      const propertyId = ticketAny.property_id;
      if (!propertyId) {
        return NextResponse.json({ error: "Ticket has no property" }, { status: 400 });
      }
      const { data: property } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", propertyId)
        .single();
      const isOwner = (property as { owner_id?: string } | null)?.owner_id === profile.id;
      if (!isOwner) {
        return NextResponse.json({ error: "Accès non autorisé à ce ticket" }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const fileValidation = validateFile(file, {
      allowedMimeTypes: [...ALLOWED_MIME_TYPES.images, "application/pdf"],
      maxSize: MAX_FILE_SIZE,
    });
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: fileValidation.error || "Fichier invalide" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const storagePath = `tickets/${ticketId}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(storagePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || "Erreur lors de l'upload" },
        { status: 500 }
      );
    }

    let ownerId: string | null = null;
    if (profile.role === "owner" && ticketAny.property_id) {
      const { data: prop } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", ticketAny.property_id)
        .single();
      ownerId = (prop as { owner_id?: string } | null)?.owner_id ?? null;
    } else if (profile.role !== "owner" && ticketAny.property_id) {
      const { data: prop } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", ticketAny.property_id)
        .single();
      ownerId = (prop as { owner_id?: string } | null)?.owner_id ?? null;
    }

    const { data: document, error: docError } = await serviceClient
      .from("documents")
      .insert({
        type: "ticket_attachment",
        storage_path: storagePath,
        property_id: ticketAny.property_id ?? null,
        owner_id: ownerId,
        tenant_id: profile.role === "tenant" ? profile.id : null,
        metadata: { ticket_id: ticketId },
        created_by_profile_id: profile.id,
      } as Record<string, unknown>)
      .select()
      .single();

    if (docError) {
      await serviceClient.storage.from("documents").remove([storagePath]);
      return NextResponse.json(
        { error: docError.message || "Erreur lors de l'enregistrement du document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/tickets/[id]/attachments]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
