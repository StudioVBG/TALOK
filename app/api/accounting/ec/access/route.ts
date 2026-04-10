/**
 * API Route: Expert-Comptable Access Management
 * POST /api/accounting/ec/access - Invite an EC to access an entity
 * GET  /api/accounting/ec/access - List EC accesses for an entity
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { sendEmail } from "@/lib/emails/resend.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const GrantAccessSchema = z.object({
  entityId: z.string().uuid(),
  ecEmail: z.string().email(),
  ecFirmName: z.string().min(1).max(255),
  accessLevel: z.enum(["read", "annotate", "validate"]),
});

const SendDeclarationSchema = z.object({
  action: z.literal("send_declaration"),
  entityId: z.string().uuid(),
  year: z.number().int().min(2020),
  declarationType: z.string().optional(),
});

/**
 * POST /api/accounting/ec/access
 *
 * Two modes (discriminated by `action` field):
 * - Default (no `action`) : grant an expert-comptable access to an entity's
 *   accounting data (invite flow).
 * - `action: "send_declaration"` : notify every active expert-comptable linked
 *   to the entity that a new fiscal declaration is ready. Does not ship the
 *   PDF itself — the email contains a link to the owner's Talok workspace
 *   where the EC can download it from the Exports tab.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();

    // ── Branch 1: send declaration notification to active EC(s) ──────────
    if (body && typeof body === "object" && (body as Record<string, unknown>).action === "send_declaration") {
      const sendValidation = SendDeclarationSchema.safeParse(body);
      if (!sendValidation.success) {
        throw new ApiError(400, sendValidation.error.errors[0].message);
      }
      const { entityId: targetEntityId, year, declarationType } = sendValidation.data;

      // Load active EC accesses for the entity
      const { data: activeAccesses } = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: boolean) => Promise<{
                data: Array<{ id: string; ec_email: string; ec_name: string | null }> | null;
              }>;
            };
          };
        };
      })
        .from("ec_access")
        .select("id, ec_email, ec_name")
        .eq("entity_id", targetEntityId)
        .eq("is_active", true);

      if (!activeAccesses || activeAccesses.length === 0) {
        return NextResponse.json(
          {
            error:
              "Aucun expert-comptable actif n'est lié à cette entité. Invitez-le d'abord depuis Expert-comptable.",
          },
          { status: 404 },
        );
      }

      const declLabel = declarationType ? declarationType.toUpperCase() : "fiscale";
      const subject = `Talok — Déclaration ${declLabel} ${year} prête à consulter`;
      const html = `
        <h2>Déclaration ${declLabel} ${year}</h2>
        <p>Bonjour,</p>
        <p>Une nouvelle déclaration ${declLabel} est disponible pour l'année ${year}.</p>
        <p>Connectez-vous à votre espace Talok pour consulter et télécharger les exports comptables (récapitulatif fiscal, FEC, grand livre, balance).</p>
        <p>Cordialement,<br/>L'équipe Talok</p>
      `;

      await Promise.all(
        activeAccesses.map((access) =>
          sendEmail({
            to: access.ec_email,
            subject,
            html,
            tags: [{ name: "category", value: "ec-declaration" }],
          }),
        ),
      );

      return NextResponse.json({
        success: true,
        data: { notified: activeAccesses.length },
      });
    }

    // ── Branch 2: invite flow (default) ──────────────────────────────────
    const validation = GrantAccessSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entityId, ecEmail, ecFirmName, accessLevel } = validation.data;

    // Check if an active access already exists for this email + entity
    const { data: existing } = await (supabase as any)
      .from("ec_access")
      .select("id")
      .eq("entity_id", entityId)
      .eq("ec_email", ecEmail)
      .eq("is_active", true)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new ApiError(409, "Cet expert-comptable a deja acces a cette entite");
    }

    // Check if email matches an existing profile (for linking)
    const { data: ecProfile } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("email", ecEmail)
      .single();

    // Insert ec_access
    const { data: access, error: insertError } = await (supabase as any)
      .from("ec_access")
      .insert({
        entity_id: entityId,
        ec_email: ecEmail,
        ec_name: ecFirmName,
        access_level: accessLevel,
        granted_by: user.id,
        ec_user_id: ecProfile?.user_id ?? null,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new ApiError(500, "Erreur lors de la creation de l'acces");
    }

    // Fetch entity name for the email
    const { data: entity } = await supabase
      .from("entities")
      .select("name")
      .eq("id", entityId)
      .single();

    // Send invitation email via Resend
    await sendEmail({
      to: ecEmail,
      subject: `Talok - Invitation a acceder a la comptabilite de ${entity?.name ?? "un client"}`,
      html: `
        <h2>Invitation Expert-Comptable</h2>
        <p>Bonjour,</p>
        <p>Vous avez ete invite(e) a acceder a la comptabilite de <strong>${entity?.name ?? "un client"}</strong> sur Talok.</p>
        <p>Cabinet : <strong>${ecFirmName}</strong></p>
        <p>Niveau d'acces : <strong>${accessLevel === "read" ? "Lecture seule" : accessLevel === "annotate" ? "Annotations" : "Validation"}</strong></p>
        <p>Connectez-vous a votre espace expert-comptable pour consulter les donnees.</p>
      `,
      tags: [{ name: "category", value: "ec-invitation" }],
    });

    return NextResponse.json(
      { success: true, data: { accessId: access.id, invited: true } },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/accounting/ec/access?entityId=...
 * List all active EC accesses for an entity.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    const { data: accesses, error } = await (supabase as any)
      .from("ec_access")
      .select("*")
      .eq("entity_id", entityId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ApiError(500, "Erreur lors de la recuperation des acces EC");
    }

    return NextResponse.json({ success: true, data: { accesses: accesses || [] } });
  } catch (error) {
    return handleApiError(error);
  }
}
