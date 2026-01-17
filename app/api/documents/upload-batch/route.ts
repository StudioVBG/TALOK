export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { documentSchema } from "@/lib/validations";
import { ensureDocumentGallerySupport } from "@/lib/server/document-gallery";


function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

import { documentAiService } from "@/features/documents/services/document-ai.service";

export async function POST(request: Request) {
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
        { error: "Configuration Supabase manquante (service role key)" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const propertyId = formData.get("propertyId")?.toString() || null;
    const leaseId = formData.get("leaseId")?.toString() || null;
    const type = formData.get("type")?.toString();
    const collection = formData.get("collection")?.toString() || "property_media";
    const metadataRaw = formData.get("metadata")?.toString();

    if (!type) {
      return NextResponse.json({ error: "Le type de document est requis." }, { status: 400 });
    }

    const files = formData.getAll("files").filter((file): file is File => file instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `Le fichier ${file.name} dépasse la taille maximale autorisée (10 Mo).`,
          },
          { status: 400 }
        );
      }
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
      .select("id, role, first_name, last_name")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const profileData = profile as any;
    const profileId = profileData.id as string;
    const role = profileData.role as string;
    let resolvedPropertyId = propertyId;
    let ownerId: string | null = null;

    if (resolvedPropertyId) {
      const { data: property, error: propertyError } = await serviceClient
        .from("properties")
        .select("id, owner_id")
        .eq("id", resolvedPropertyId)
        .single();

      if (propertyError || !property) {
        return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
      }

      ownerId = property.owner_id as string;
      const isOwner = ownerId === profileId;
      const isAdmin = role === "admin";

      if (!isOwner && !isAdmin) {
        return NextResponse.json(
          { error: "Vous n'avez pas la permission d'ajouter des documents à ce logement." },
          { status: 403 }
        );
      }
    } else if (leaseId) {
      // Récupérer la propriété via le bail
      const { data: lease, error: leaseError } = await serviceClient
        .from("leases")
        .select("id, property_id")
        .eq("id", leaseId)
        .single();

      if (leaseError || !lease) {
        return NextResponse.json({ error: "Bail introuvable" }, { status: 404 });
      }

      resolvedPropertyId = lease.property_id as string;

      const { data: property, error: propertyError } = await serviceClient
        .from("properties")
        .select("id, owner_id")
        .eq("id", resolvedPropertyId)
        .single();

      if (propertyError || !property) {
        return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
      }

      ownerId = property.owner_id as string;
      const isOwner = ownerId === profileId;
      const isAdmin = role === "admin";

      if (!isOwner && !isAdmin) {
        return NextResponse.json(
          { error: "Vous n'avez pas la permission d'ajouter des documents à ce bail." },
          { status: 403 }
        );
      }
    } else {
      // Documents non liés à une propriété : réservé aux admins / propriétaires
      if (!["owner", "admin"].includes(role)) {
        return NextResponse.json(
          { error: "Vous n'avez pas la permission d'ajouter ce document." },
          { status: 403 }
        );
      }
      ownerId = role === "owner" ? profileId : null;
    }

    let metadata: Record<string, unknown> | null = null;
    if (metadataRaw) {
      try {
        metadata = JSON.parse(metadataRaw);
      } catch {
        return NextResponse.json(
          { error: "Le format des métadonnées est invalide (JSON attendu)." },
          { status: 400 }
        );
      }
    }

    const supportsGallery = await ensureDocumentGallerySupport(serviceClient);
    const effectiveCollection = supportsGallery ? collection : "property_media";

    // Validation Zod supplémentaire (throw si invalide)
    documentSchema.parse({
      type,
      property_id: resolvedPropertyId,
      lease_id: leaseId,
      collection: supportsGallery ? collection : undefined,
    });

    let existingDocs: any[] = [];
    let currentMaxPosition = 0;
    let hasCover = false;

    if (supportsGallery && resolvedPropertyId) {
      const { data: docs, error: docsError } = await serviceClient
        .from("documents")
        .select("id, position, is_cover")
        .eq("collection", effectiveCollection)
        .eq("property_id", resolvedPropertyId)
        .order("position", { ascending: true });

      if (docsError) {
        throw docsError;
      }
      existingDocs = docs ?? [];
      currentMaxPosition =
        existingDocs.reduce((max, doc) => {
          const pos = doc.position ?? 0;
          return pos > max ? pos : max;
        }, 0) ?? 0;
      hasCover = existingDocs.some((doc) => doc.is_cover) ?? false;
    }

    const insertedDocuments = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const fileExt = file.name.split(".").pop() ?? "bin";
      const fileName = `${randomUUID()}.${fileExt}`;
      const filePath = `documents/${effectiveCollection}/${fileName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await serviceClient.storage
        .from("documents")
        .upload(filePath, buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        console.error("Erreur upload storage:", uploadError);
        return NextResponse.json(
          { error: `Erreur lors de l'upload du fichier ${file.name}` },
          { status: 500 }
        );
      }

      const {
        data: { publicUrl },
      } = serviceClient.storage.from("documents").getPublicUrl(filePath);

      const record: Record<string, unknown> = {
        type,
        property_id: resolvedPropertyId,
        lease_id: leaseId,
        owner_id: ownerId,
        tenant_id: role === "tenant" ? profileId : null,
        storage_path: filePath,
        metadata,
        preview_url: isImage(file.type) ? publicUrl : null,
        title: file.name,
        notes: null,
      };

      if (supportsGallery) {
        record.collection = effectiveCollection;
        record.position = currentMaxPosition + index + 1;
        record.is_cover = !hasCover && index === 0;
        record.uploaded_by = profileId;
      }

      const { data: document, error: insertError } = await serviceClient
        .from("documents")
        .insert(record as any)
        .select()
        .single();

      if (insertError || !document) {
        return NextResponse.json(
          { error: insertError?.message || `Erreur lors de l'enregistrement du fichier ${file.name}` },
          { status: 500 }
        );
      }

      // Trigger AI Analysis
      try {
        let tenantName: string | undefined;
        if (role === "tenant") {
          const p = profileData as any;
          if (p.first_name && p.last_name) {
            tenantName = `${p.first_name} ${p.last_name}`;
          }
        }

        const publicUrlForAnalysis =
          (record.preview_url as string) ||
          serviceClient.storage.from("documents").getPublicUrl(filePath).data.publicUrl;

        // We await here to ensure execution in serverless environment, 
        // though ideally this would be offloaded to a background job
        await documentAiService.analyzeDocument(
          (document as any).id,
          publicUrlForAnalysis,
          type,
          tenantName
        );
      } catch (aiError) {
        console.error("AI Analysis failed for doc", (document as any).id, aiError);
        // Do not block upload success if AI fails
      }

      insertedDocuments.push(document);
    }

    // Récupérer les documents mis à jour pour la collection
    let refreshedDocsQuery = serviceClient.from("documents").select("*");
    if (resolvedPropertyId) {
      refreshedDocsQuery = refreshedDocsQuery.eq("property_id", resolvedPropertyId);
    }
    if (supportsGallery) {
      refreshedDocsQuery = refreshedDocsQuery.eq("collection", effectiveCollection).order("position", { ascending: true });
    } else {
      refreshedDocsQuery = refreshedDocsQuery.order("created_at", { ascending: false });
    }

    const { data: refreshedDocs, error: refreshedError } = await refreshedDocsQuery;

    if (refreshedError) {
      throw refreshedError;
    }

    return NextResponse.json({ documents: refreshedDocs });
  } catch (error: unknown) {
    console.error("Error in POST /api/documents/upload-batch:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: error.status || 500 }
    );
  }
}





