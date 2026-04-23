/**
 * POST /api/accounting/ec-access/send-exports
 *
 * Builds the accounting pack and emails it (as a ZIP attachment) to every
 * active expert-comptable registered on the given entity. Used from the
 * "Envoyer les exports" button on the Exports page and triggered
 * automatically from the exercise closing flow when `auto_send_on_closing`
 * is enabled.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { buildAccountingPack } from "@/lib/accounting/exports/pack";
import { sendEmail } from "@/lib/emails/resend.service";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  entityId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "pack");
    if (featureGate) return featureGate;

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors[0].message);
    }
    const { entityId, exerciseId } = parsed.data;

    const { data: entity } = await serviceClient
      .from("legal_entities")
      .select("id, nom, siret, regime_fiscal, owner_profile_id")
      .eq("id", entityId)
      .maybeSingle();
    if (!entity) throw new ApiError(404, "Entité introuvable");
    if (profile.role !== "admin" && entity.owner_profile_id !== profile.id) {
      throw new ApiError(403, "Accès refusé à cette entité");
    }

    const { data: exercise } = await serviceClient
      .from("accounting_exercises")
      .select("id, start_date, end_date")
      .eq("id", exerciseId)
      .eq("entity_id", entityId)
      .maybeSingle();
    if (!exercise) throw new ApiError(404, "Exercice introuvable");

    const { data: ecs } = await serviceClient
      .from("ec_access")
      .select("id, ec_email, ec_name")
      .eq("entity_id", entityId)
      .eq("is_active", true);

    if (!ecs || ecs.length === 0) {
      throw new ApiError(
        404,
        "Aucun expert-comptable actif n'est lié à cette entité.",
      );
    }

    const siren = entity.siret ? String(entity.siret).slice(0, 9) : null;
    const exerciseLabel = `${exercise.start_date.slice(0, 4)}`;

    const pack = await buildAccountingPack(serviceClient, {
      entityId,
      exerciseId,
      siren,
      entityName: entity.nom ?? "Entite",
      exerciseLabel,
      startDate: exercise.start_date,
      endDate: exercise.end_date,
      includeLiasse: entity.regime_fiscal === "is",
    });

    const skippedNote = pack.skipped.length > 0
      ? `<p style="color:#92400e;font-size:13px;">Note: ${pack.skipped
          .map((s) => s.replace(/</g, "&lt;"))
          .join(" · ")}</p>`
      : "";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#0f172a;">Pack comptable ${exerciseLabel} — ${entity.nom ?? ""}</h2>
        <p>Bonjour,</p>
        <p>
          Vous trouverez en pièce jointe le pack comptable
          <strong>${pack.filename}</strong> généré par Talok pour l&rsquo;exercice
          ${exercise.start_date} → ${exercise.end_date}.
        </p>
        <p>Il contient :</p>
        <ul>
          <li>FEC (Fichier des Écritures Comptables)</li>
          <li>Balance comptable (PDF)</li>
          <li>Grand livre (PDF)</li>
          <li>Journal général (PDF)</li>
          ${entity.regime_fiscal === "is" ? "<li>Liasse fiscale préparatoire (note)</li>" : ""}
        </ul>
        ${skippedNote}
        <p style="color:#64748b;font-size:13px;">
          Envoyé depuis Talok. Pour toute question, répondez directement à cet email.
        </p>
      </div>`;

    const activeEcs = ecs as Array<{
      id: string;
      ec_email: string;
      ec_name: string | null;
    }>;

    const results = await Promise.all(
      activeEcs.map((ec) =>
        sendEmail({
          to: ec.ec_email,
          subject: `Pack comptable ${exerciseLabel} — ${entity.nom ?? ""}`,
          html,
          attachments: [
            { filename: pack.filename, content: pack.zip },
          ],
          tags: [
            { name: "type", value: "accounting_pack" },
            { name: "entity", value: entityId },
          ],
          idempotencyKey: `ec-pack-${ec.id}-${exerciseId}`,
        }),
      ),
    );

    const failures = results.filter((r: { success: boolean }) => !r.success);
    if (failures.length === results.length) {
      throw new ApiError(502, "L'envoi a échoué pour tous les destinataires.");
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: results.length - failures.length,
        failed: failures.length,
        skipped: pack.skipped,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
