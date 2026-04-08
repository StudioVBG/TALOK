// @ts-nocheck
/**
 * API Route: Expert-Comptable Annotations
 * POST /api/accounting/ec/annotations - Create annotation
 * GET  /api/accounting/ec/annotations - List annotations for an entity
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { sendEmail } from "@/lib/emails/resend.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateAnnotationSchema = z.object({
  entityId: z.string().uuid(),
  entryId: z.string().uuid().optional(),
  exerciseId: z.string().uuid().optional(),
  annotationType: z.enum(["comment", "question", "correction", "validation"]),
  content: z.string().min(1).max(2000),
});

/**
 * POST /api/accounting/ec/annotations
 * Create an annotation. User must have ec_access for the entity.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const body = await request.json();
    const validation = CreateAnnotationSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entityId, entryId, exerciseId, annotationType, content } = validation.data;

    // Verify user has ec_access for this entity
    const { data: access } = await (supabase as any)
      .from("ec_access")
      .select("id, access_level, ec_name")
      .eq("entity_id", entityId)
      .eq("ec_user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!access) {
      // Also check by email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user.id)
        .single();

      if (profile?.email) {
        const { data: accessByEmail } = await (supabase as any)
          .from("ec_access")
          .select("id, access_level, ec_name")
          .eq("entity_id", entityId)
          .eq("ec_email", profile.email)
          .eq("is_active", true)
          .single();

        if (!accessByEmail) {
          throw new ApiError(403, "Vous n'avez pas acces a cette entite");
        }

        // Check access level allows annotations
        if (accessByEmail.access_level === "read") {
          throw new ApiError(403, "Votre niveau d'acces ne permet pas les annotations");
        }
      } else {
        throw new ApiError(403, "Vous n'avez pas acces a cette entite");
      }
    } else if (access.access_level === "read") {
      throw new ApiError(403, "Votre niveau d'acces ne permet pas les annotations");
    }

    // Insert annotation
    const { data: annotation, error: insertError } = await (supabase as any)
      .from("ec_annotations")
      .insert({
        entity_id: entityId,
        entry_id: entryId ?? null,
        exercise_id: exerciseId ?? null,
        annotation_type: annotationType,
        content,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      throw new ApiError(500, "Erreur lors de la creation de l'annotation");
    }

    // Notify entity owner by email
    const { data: entity } = await (supabase as any)
      .from("entities")
      .select("name, owner_id")
      .eq("id", entityId)
      .single();

    if (entity?.owner_id) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", entity.owner_id)
        .single();

      if (ownerProfile?.email) {
        const typeLabels: Record<string, string> = {
          comment: "Commentaire",
          question: "Question",
          correction: "Correction demandee",
          validation: "Validation",
        };

        await sendEmail({
          to: ownerProfile.email,
          subject: `Talok - Nouvelle annotation de votre expert-comptable`,
          html: `
            <h2>Nouvelle annotation</h2>
            <p>Votre expert-comptable a ajoute une annotation sur la comptabilite de <strong>${entity.name}</strong>.</p>
            <p>Type : <strong>${typeLabels[annotationType] ?? annotationType}</strong></p>
            <p>${content}</p>
            <p>Connectez-vous a Talok pour consulter et repondre.</p>
          `,
          tags: [{ name: "category", value: "ec-annotation" }],
        });
      }
    }

    return NextResponse.json(
      { success: true, data: { annotation } },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/accounting/ec/annotations?entityId=...&resolved=...
 * List annotations for an entity with optional resolved filter.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const resolved = searchParams.get("resolved");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    let query = (supabase as any)
      .from("ec_annotations")
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (resolved === "true") {
      query = query.not("resolved_at", "is", null);
    } else if (resolved === "false") {
      query = query.is("resolved_at", null);
    }

    const { data: annotations, error } = await query;

    if (error) {
      throw new ApiError(500, "Erreur lors de la recuperation des annotations");
    }

    return NextResponse.json({ success: true, data: { annotations: annotations || [] } });
  } catch (error) {
    return handleApiError(error);
  }
}
