export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/service-client";
import { sendEmail } from "@/lib/emails/resend.service";
import { applyRateLimit } from "@/lib/security/rate-limit";

/**
 * POST /api/agency/mandates/sign/[token]
 *
 * Le mandant signe ou refuse le mandat via le token reçu par email.
 * - action='sign'   → signature_status='signed' + status='active' + signature_completed_at
 * - action='refuse' → signature_status='refused' (status reste 'draft')
 *
 * Capture IP + User-Agent pour audit trail (eIDAS SES).
 * Token valide 30 jours après signature_sent_at.
 *
 * Endpoint PUBLIC (pas d'auth) — la sécurité repose sur l'unicité du token.
 * Rate limit pour éviter le brute-force.
 */

const TOKEN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sign"),
    signature_name: z.string().min(3).max(200),
  }),
  z.object({
    action: z.literal("refuse"),
    refuse_reason: z.string().min(5).max(1000),
  }),
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  // Rate limit (anti brute-force token) — preset signature : 10 req/min
  const rateLimitResponse = await applyRateLimit(request, "signature").catch(
    () => null,
  );
  if (rateLimitResponse) return rateLimitResponse as unknown as NextResponse;

  try {
    const { token } = await context.params;

    if (!token || token.length < 16) {
      return NextResponse.json({ error: "Token invalide" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.errors },
        { status: 400 },
      );
    }

    const serviceClient = getServiceClient();

    // 1. Récupérer le mandat par token
    const { data: mandate, error: mandateError } = await serviceClient
      .from("agency_mandates")
      .select(
        `
        id, mandate_number, status, signature_status, signature_sent_at,
        agency_profile_id, owner_profile_id,
        agency:profiles!agency_mandates_agency_profile_id_fkey(
          id, prenom, nom, email
        ),
        owner:profiles!agency_mandates_owner_profile_id_fkey(
          id, prenom, nom, email
        )
      `,
      )
      .eq("signature_token", token)
      .maybeSingle();

    if (mandateError || !mandate) {
      return NextResponse.json(
        { error: "Mandat introuvable" },
        { status: 404 },
      );
    }

    // 2. Vérifier que le mandat est en attente
    if (mandate.signature_status !== "pending") {
      return NextResponse.json(
        {
          error:
            mandate.signature_status === "signed"
              ? "Mandat déjà signé"
              : "Ce mandat n'est plus en attente de signature",
        },
        { status: 409 },
      );
    }

    // 3. Vérifier l'expiration
    if (mandate.signature_sent_at) {
      const sentAt = new Date(mandate.signature_sent_at).getTime();
      if (Date.now() - sentAt > TOKEN_VALIDITY_MS) {
        await serviceClient
          .from("agency_mandates")
          .update({ signature_status: "expired" })
          .eq("id", mandate.id);
        return NextResponse.json(
          { error: "Lien de signature expiré (30 jours)" },
          { status: 410 },
        );
      }
    }

    // 4. Capturer IP + UA pour audit trail (eIDAS SES)
    const userAgent = request.headers.get("user-agent") || null;
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    const now = new Date().toISOString();

    const agency = (mandate as any).agency as {
      prenom: string;
      nom: string;
      email: string;
    } | null;
    const owner = (mandate as any).owner as {
      prenom: string;
      nom: string;
      email: string;
    } | null;

    const ownerName =
      owner ? `${owner.prenom ?? ""} ${owner.nom ?? ""}`.trim() : "Le mandant";
    const agencyName =
      agency ? `${agency.prenom ?? ""} ${agency.nom ?? ""}`.trim() : "L'agence";

    if (parsed.data.action === "sign") {
      // 5a. Signer : update signature + activer le mandat
      const { error: updateError } = await serviceClient
        .from("agency_mandates")
        .update({
          signature_status: "signed",
          signature_completed_at: now,
          signature_ip: ip,
          signature_user_agent: userAgent,
          status: "active",
          // Invalider le token pour empêcher toute resignature
          signature_token: null,
        })
        .eq("id", mandate.id);

      if (updateError) {
        return NextResponse.json(
          { error: `Erreur DB: ${updateError.message}` },
          { status: 500 },
        );
      }

      // Outbox event
      await serviceClient.from("outbox").insert({
        event_type: "Agency.MandateSigned",
        payload: {
          mandate_id: mandate.id,
          mandate_number: mandate.mandate_number,
          agency_profile_id: mandate.agency_profile_id,
          owner_profile_id: mandate.owner_profile_id,
          signed_at: now,
          signature_name: parsed.data.signature_name,
          ip,
        },
      });

      // Email confirmation à l'agence
      if (agency?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.talok.fr";
        await sendEmail({
          to: agency.email,
          subject: `✅ Mandat ${mandate.mandate_number} signé`,
          html: `
            <p>Bonjour ${agencyName},</p>
            <p>Bonne nouvelle : <strong>${ownerName}</strong> vient de signer le
            mandat <strong>${mandate.mandate_number}</strong>. Le mandat est
            désormais <strong>actif</strong>.</p>
            <p>Vous pouvez démarrer la gestion locative depuis votre espace agence :</p>
            <p><a href="${appUrl}/agency/mandates/${mandate.id}">Voir le mandat</a></p>
            <p>—<br/>L'équipe Talok</p>
          `,
          idempotencyKey: `mandate-signed/${mandate.id}`,
          tags: [{ name: "type", value: "mandate_signed" }],
        }).catch((err) => {
          console.error("[mandate-sign] email agency failed:", err);
        });
      }

      // Email confirmation au mandant
      if (owner?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.talok.fr";
        await sendEmail({
          to: owner.email,
          subject: `Confirmation de signature — Mandat ${mandate.mandate_number}`,
          html: `
            <p>Bonjour ${ownerName},</p>
            <p>Nous confirmons la signature de votre mandat
            <strong>${mandate.mandate_number}</strong> avec
            <strong>${agencyName}</strong>.</p>
            <p>Date de signature : ${new Date(now).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}</p>
            <p>Adresse IP de signature : ${ip ?? "non capturée"}</p>
            <p>Vous pouvez consulter votre mandat à tout moment :</p>
            <p><a href="${appUrl}/owner/dashboard">Accéder à mon espace</a></p>
            <p>—<br/>L'équipe Talok</p>
          `,
          idempotencyKey: `mandate-signed-owner/${mandate.id}`,
          tags: [{ name: "type", value: "mandate_signed_confirmation" }],
        }).catch((err) => {
          console.error("[mandate-sign] email owner failed:", err);
        });
      }

      return NextResponse.json({
        success: true,
        mandate_id: mandate.id,
        signature_status: "signed",
        status: "active",
      });
    }

    // 5b. Refuser : marque comme refused (status reste draft)
    const { error: refuseError } = await serviceClient
      .from("agency_mandates")
      .update({
        signature_status: "refused",
        signature_completed_at: now,
        signature_ip: ip,
        signature_user_agent: userAgent,
        signature_token: null,
      })
      .eq("id", mandate.id);

    if (refuseError) {
      return NextResponse.json(
        { error: `Erreur DB: ${refuseError.message}` },
        { status: 500 },
      );
    }

    await serviceClient.from("outbox").insert({
      event_type: "Agency.MandateRefused",
      payload: {
        mandate_id: mandate.id,
        mandate_number: mandate.mandate_number,
        agency_profile_id: mandate.agency_profile_id,
        owner_profile_id: mandate.owner_profile_id,
        refused_at: now,
        reason: parsed.data.refuse_reason,
        ip,
      },
    });

    // Email à l'agence
    if (agency?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.talok.fr";
      await sendEmail({
        to: agency.email,
        subject: `❌ Mandat ${mandate.mandate_number} refusé`,
        html: `
          <p>Bonjour ${agencyName},</p>
          <p><strong>${ownerName}</strong> a refusé le mandat
          <strong>${mandate.mandate_number}</strong>.</p>
          <p><strong>Motif :</strong></p>
          <blockquote>${parsed.data.refuse_reason}</blockquote>
          <p>Vous pouvez recontacter le mandant pour discuter ou créer un
          nouveau mandat révisé :</p>
          <p><a href="${appUrl}/agency/mandates/${mandate.id}">Voir le mandat</a></p>
          <p>—<br/>L'équipe Talok</p>
        `,
        idempotencyKey: `mandate-refused/${mandate.id}`,
        tags: [{ name: "type", value: "mandate_refused" }],
      }).catch((err) => {
        console.error("[mandate-sign] email refuse agency failed:", err);
      });
    }

    return NextResponse.json({
      success: true,
      mandate_id: mandate.id,
      signature_status: "refused",
    });
  } catch (error) {
    console.error("[mandate-sign] unexpected:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}
