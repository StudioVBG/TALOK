export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { withSecurity } from "@/lib/api/with-security";

/**
 * POST /api/deposits/[id]/restitute
 *
 * Restitute a security deposit (full or partial).
 *
 * Règles loi n°89-462:
 * - EDL conforme → restitution sous 1 mois
 * - Dégradations → restitution sous 2 mois, retenues justifiées
 * - Pénalité de retard : 10% du loyer/mois de retard
 */
const restituteSchema = z.object({
  restitution_amount_cents: z.number().int().min(0),
  retenue_cents: z.number().int().min(0).default(0),
  retenue_details: z
    .array(
      z.object({
        type: z.string(),
        label: z.string(),
        amount_cents: z.number().int().min(0),
        justification: z.string().optional(),
      })
    )
    .default([]),
  restitution_method: z.enum(["bank_transfer", "check", "sepa_credit"]).default("bank_transfer"),
  restitution_due_date: z.string().optional(),
});

export const POST = withSecurity(
  async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ) {
    try {
      const { user, error } = await getAuthenticatedUser(request);

      if (error || !user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }

      const { id: depositId } = await context.params;
      const serviceClient = getServiceClient();

      // Profile check
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .single();

      if (!profile || (profile as any).role !== "owner") {
        return NextResponse.json(
          { error: "Seuls les propriétaires peuvent restituer un dépôt" },
          { status: 403 }
        );
      }

      // Get deposit
      const { data: deposit, error: depositError } = await serviceClient
        .from("security_deposits")
        .select(`
          *,
          lease:leases(
            id,
            property:properties(owner_id)
          )
        `)
        .eq("id", depositId)
        .single();

      if (depositError || !deposit) {
        return NextResponse.json(
          { error: "Dépôt de garantie non trouvé" },
          { status: 404 }
        );
      }

      const typedDeposit = deposit as any;

      // Authorization
      if (typedDeposit.lease?.property?.owner_id !== (profile as any).id) {
        return NextResponse.json(
          { error: "Non autorisé" },
          { status: 403 }
        );
      }

      // Must be in 'received' status to restitute
      if (typedDeposit.status !== "received") {
        return NextResponse.json(
          {
            error: `Impossible de restituer un dépôt en statut "${typedDeposit.status}"`,
          },
          { status: 409 }
        );
      }

      // Validate body
      const body = await request.json();
      const validated = restituteSchema.parse(body);

      // Sanity: restitution + retenue should equal deposit
      const totalReturn =
        validated.restitution_amount_cents + validated.retenue_cents;
      if (totalReturn !== typedDeposit.amount_cents) {
        return NextResponse.json(
          {
            error: `Le montant restitué (${validated.restitution_amount_cents}) + les retenues (${validated.retenue_cents}) doivent égaler le dépôt (${typedDeposit.amount_cents})`,
          },
          { status: 400 }
        );
      }

      // Determine status
      const newStatus =
        validated.retenue_cents > 0 ? "partially_returned" : "returned";

      // Update
      const { data: updated, error: updateError } = await serviceClient
        .from("security_deposits")
        .update({
          restitution_amount_cents: validated.restitution_amount_cents,
          retenue_cents: validated.retenue_cents,
          retenue_details: validated.retenue_details,
          restitution_method: validated.restitution_method,
          restitution_due_date: validated.restitution_due_date || null,
          restituted_at: new Date().toISOString(),
          status: newStatus,
        } as any)
        .eq("id", depositId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Emit event for notifications
      await serviceClient.from("outbox").insert({
        event_type: "Deposit.Restituted",
        payload: {
          deposit_id: depositId,
          lease_id: typedDeposit.lease_id,
          tenant_id: typedDeposit.tenant_id,
          amount_restituted: validated.restitution_amount_cents,
          retenue: validated.retenue_cents,
          method: validated.restitution_method,
        },
      } as any);

      // Audit log
      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        action: "deposit_restituted",
        entity_type: "security_deposit",
        entity_id: depositId,
        metadata: {
          restitution_amount_cents: validated.restitution_amount_cents,
          retenue_cents: validated.retenue_cents,
          method: validated.restitution_method,
        },
      } as any);

      return NextResponse.json({ deposit: updated });
    } catch (err: unknown) {
      if ((err as any).name === "ZodError") {
        return NextResponse.json(
          { error: "Données invalides", details: (err as any).errors },
          { status: 400 }
        );
      }
      console.error("[POST /api/deposits/[id]/restitute] Error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur serveur" },
        { status: 500 }
      );
    }
  },
  { routeName: "POST /api/deposits/[id]/restitute", csrf: true }
);
