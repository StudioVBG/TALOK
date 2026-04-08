// @ts-nocheck
/**
 * API Route: CRG Detail
 * GET  /api/accounting/crg/:id        - Get single CRG detail
 * POST /api/accounting/crg/:id        - Actions (send email to mandant)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET — Single CRG detail
// ---------------------------------------------------------------------------

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const featureGate = await requireAccountingAccess(profile.id, "crg");
    if (featureGate) return featureGate;

    // Fetch CRG report
    const { data: crg, error: crgError } = await supabase
      .from("crg_reports")
      .select("*")
      .eq("id", id)
      .single();

    if (crgError || !crg) {
      throw new ApiError(404, "CRG non trouve");
    }

    // Fetch mandant info
    const { data: mandant } = await supabase
      .from("mandant_accounts")
      .select("id, mandant_name, sub_account_number, commission_rate, owner_entity_id")
      .eq("id", crg.mandant_id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        ...crg,
        mandant: mandant ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST — CRG actions (send email)
// ---------------------------------------------------------------------------

const CRGActionSchema = z.object({
  action: z.enum(["send"]),
  recipientEmail: z.string().email().optional(),
});

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const featureGate = await requireAccountingAccess(profile.id, "crg");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = CRGActionSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { action, recipientEmail } = validation.data;

    // Fetch CRG report
    const { data: crg, error: crgError } = await supabase
      .from("crg_reports")
      .select("*")
      .eq("id", id)
      .single();

    if (crgError || !crg) {
      throw new ApiError(404, "CRG non trouve");
    }

    if (action === "send") {
      // Resolve mandant owner email if not provided
      let email = recipientEmail;

      if (!email) {
        const { data: mandant } = await supabase
          .from("mandant_accounts")
          .select("owner_entity_id")
          .eq("id", crg.mandant_id)
          .single();

        if (mandant) {
          // Try to find email from legal_entities -> profiles
          const { data: entity } = await supabase
            .from("legal_entities")
            .select("id, name")
            .eq("id", mandant.owner_entity_id)
            .single();

          if (entity) {
            // Find a profile linked to this entity
            const { data: ownerProfile } = await supabase
              .from("profiles")
              .select("id, email")
              .eq("legal_entity_id", entity.id)
              .limit(1)
              .single();

            email = ownerProfile?.email ?? null;
          }
        }
      }

      if (!email) {
        throw new ApiError(
          400,
          "Impossible de determiner l'email du mandant. Fournissez recipientEmail.",
        );
      }

      // Insert notification to send CRG by email
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: user.id,
          type: "crg_sent",
          title: `CRG envoye - Periode ${crg.period_start} a ${crg.period_end}`,
          body: `Le Compte Rendu de Gestion a ete envoye a ${email}`,
          metadata: {
            crg_id: id,
            recipient_email: email,
            period_start: crg.period_start,
            period_end: crg.period_end,
          },
        });

      if (notifError) {
        console.error("[CRG Send] Notification insert error:", notifError);
      }

      // Update CRG status to sent
      await supabase
        .from("crg_reports")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_to: email,
        })
        .eq("id", id);

      return NextResponse.json({
        success: true,
        message: `CRG envoye a ${email}`,
        data: { crgId: id, sentTo: email },
      });
    }

    throw new ApiError(400, `Action inconnue: ${action}`);
  } catch (error) {
    return handleApiError(error);
  }
}
