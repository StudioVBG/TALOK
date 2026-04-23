export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { createClient } from "@/lib/supabase/server";
import { validateCsrfOrCronSecret, logCsrfFailure } from "@/lib/security/csrf";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleEDLFullySigned } from "@/lib/services/edl-post-signature.service";

/**
 * @maintenance Route utilitaire admin — usage ponctuel
 * @description Force le scellement d'un EDL qui a ses 2 signatures mais
 * n'a jamais ete scelle (status != 'signed' OU sealed_at null).
 * Typique pour les EDL signes avant le fix de scellement sync.
 *
 * Etapes :
 *  1. Verifier que l'EDL a bien les 2 signatures (owner + tenant) completes
 *  2. Forcer status='signed' si necessaire (prerequis pour seal_edl RPC)
 *  3. Generer le PDF final via generateSignedEdlPdf (force:true si demande)
 *  4. Sceller via RPC seal_edl (pose sealed_at + signed_pdf_path)
 *  5. Tracer dans audit_log
 */
export async function POST(request: Request) {
  const check = await validateCsrfOrCronSecret(request);
  if (!check.valid) {
    await logCsrfFailure(request, check.reason!, "admin.maintenance.reseal-edl");
    return NextResponse.json({ error: "CSRF ou cron secret requis" }, { status: 403 });
  }

  const auth = await requireAdminPermissions(request, ["admin.properties.write"], {
    rateLimit: "adminCritical",
    auditAction: "Reseal EDL",
  });
  if (isAdminAuthError(auth)) return auth;
  const user = auth.user;
  const supabase = await createClient();

  try {
    const body = await request.json();
    const edlId: unknown = body?.edl_id;
    const force: boolean = body?.force === true;

    if (!edlId || typeof edlId !== "string") {
      return NextResponse.json({ error: "edl_id requis" }, { status: 400 });
    }

    const serviceClient = getServiceClient();

    // 1. Charger l'EDL pour snapshot avant/apres
    const { data: edl } = await serviceClient
      .from("edl")
      .select("id, status, sealed_at, signed_pdf_path")
      .eq("id", edlId)
      .single();

    if (!edl) {
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    // 2. Safety check : les 2 signatures doivent exister et etre completes
    const { data: signatures } = await serviceClient
      .from("edl_signatures")
      .select("signer_role, signature_image_path, signed_at")
      .eq("edl_id", edlId);

    const hasOwner = (signatures || []).some(
      (s: any) =>
        (s.signer_role === "owner" || s.signer_role === "proprietaire" || s.signer_role === "bailleur") &&
        s.signature_image_path &&
        s.signed_at
    );
    const hasTenant = (signatures || []).some(
      (s: any) =>
        (s.signer_role === "tenant" || s.signer_role === "locataire" || s.signer_role === "locataire_principal") &&
        s.signature_image_path &&
        s.signed_at
    );

    if (!hasOwner || !hasTenant) {
      return NextResponse.json(
        {
          error: "EDL non eligible : signatures owner + tenant requises",
          hasOwner,
          hasTenant,
          signatures_count: signatures?.length ?? 0,
        },
        { status: 400 }
      );
    }

    const previousStatus = (edl as any).status as string;

    // 3. Forcer status='signed' si besoin (prerequis pour seal_edl RPC)
    if (previousStatus !== "signed") {
      const { error: updErr } = await serviceClient
        .from("edl")
        .update({ status: "signed" } as any)
        .eq("id", edlId);
      if (updErr) {
        return NextResponse.json(
          { error: `Echec UPDATE status='signed': ${updErr.message}` },
          { status: 500 }
        );
      }
    }

    // 4. Generation PDF + scellement atomique
    let result;
    try {
      result = await handleEDLFullySigned(edlId, { force });
    } catch (sealErr) {
      // Rollback du status si on l'a force et que le seal a echoue
      if (previousStatus !== "signed") {
        await serviceClient
          .from("edl")
          .update({ status: previousStatus } as any)
          .eq("id", edlId);
      }
      throw sealErr;
    }

    // 5. Audit (non bloquant)
    try {
      await serviceClient.from("audit_log").insert({
        user_id: user!.id,
        action: "admin_reseal_edl",
        entity_type: "edl",
        entity_id: edlId,
        metadata: {
          previous_status: previousStatus,
          previous_sealed_at: (edl as any).sealed_at,
          previous_signed_pdf_path: (edl as any).signed_pdf_path,
          new_storage_path: result.storagePath,
          sealed: result.sealed,
          force,
        },
      } as any);
    } catch {
      // audit non bloquant
    }

    return NextResponse.json({
      success: true,
      edl_id: edlId,
      storage_path: result.storagePath,
      sealed: result.sealed,
      previous_status: previousStatus,
    });
  } catch (error: unknown) {
    console.error("[admin/reseal-edl] Erreur:", error);
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(error, { tags: { route: "admin.reseal-edl" } });
    } catch {}
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
