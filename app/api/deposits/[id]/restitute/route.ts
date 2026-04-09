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
        type: z.string().optional(),
        motif: z.string().optional(),
        label: z.string().optional(),
        amount_cents: z.number().int().min(0),
        justification: z.string().optional(),
      })
    )
    .default([]),
  restitution_method: z
    .enum(["virement", "cheque", "especes", "bank_transfer", "check", "sepa_credit"])
    .default("virement"),
  restitution_due_date: z.string().optional(),
  notes: z.string().optional(),
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

      if (!profile) {
        return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
      }

      const typedProfile = profile as { id: string; role: string };
      const isAdmin = typedProfile.role === "admin";

      if (typedProfile.role !== "owner" && !isAdmin) {
        return NextResponse.json(
          { error: "Seuls les propriétaires peuvent restituer un dépôt" },
          { status: 403 }
        );
      }

      // Get deposit with lease details (needed for late penalty calc)
      const { data: deposit, error: depositError } = await serviceClient
        .from("security_deposits")
        .select(`
          *,
          lease:leases(
            id,
            statut,
            date_fin,
            loyer,
            property:properties(
              owner_id,
              adresse_complete
            )
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
      if (!isAdmin && typedDeposit.lease?.property?.owner_id !== typedProfile.id) {
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

      // Lease should be terminated
      const leaseStatus = typedDeposit.lease?.statut;
      if (leaseStatus !== "terminated" && leaseStatus !== "ended") {
        return NextResponse.json(
          { error: "Le bail doit être terminé pour restituer le dépôt" },
          { status: 400 }
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

      // Retenues must be justified
      if (validated.retenue_cents > 0 && validated.retenue_details.length === 0) {
        return NextResponse.json(
          { error: "Les retenues doivent être détaillées et justifiées" },
          { status: 400 }
        );
      }

      // Calculate late penalty (10% of monthly rent per month late)
      let latePenaltyCents = 0;
      const dueDateStr = validated.restitution_due_date || typedDeposit.restitution_due_date;
      if (dueDateStr) {
        const dueDate = new Date(dueDateStr);
        const now = new Date();
        if (now > dueDate) {
          const monthsLate = Math.ceil(
            (now.getTime() - dueDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
          );
          const monthlyRentCents = (typedDeposit.lease?.loyer || 0) * 100;
          latePenaltyCents = Math.round(monthlyRentCents * 0.1 * monthsLate);
        }
      }

      // Determine status
      const newStatus =
        validated.retenue_cents > 0 ? "partially_returned" : "returned";

      // Update deposit
      const { data: updated, error: updateError } = await serviceClient
        .from("security_deposits")
        .update({
          restitution_amount_cents: validated.restitution_amount_cents,
          retenue_cents: validated.retenue_cents,
          retenue_details: validated.retenue_details,
          restitution_method: validated.restitution_method,
          restitution_due_date: dueDateStr || null,
          restituted_at: new Date().toISOString(),
          late_penalty_cents: latePenaltyCents,
          status: newStatus,
          metadata: {
            ...(typedDeposit.metadata || {}),
            notes: validated.notes || null,
            restituted_by: user.id,
          },
        } as any)
        .eq("id", depositId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Notify tenant
      const { data: tenantProfile } = await serviceClient
        .from("profiles")
        .select("user_id, prenom, nom")
        .eq("id", typedDeposit.tenant_id)
        .single();

      if (tenantProfile?.user_id) {
        const amountEur = (validated.restitution_amount_cents / 100).toFixed(2);
        await serviceClient.from("notifications").insert({
          user_id: tenantProfile.user_id,
          type: "deposit_refund",
          title: "Restitution de votre dépôt de garantie",
          body:
            validated.restitution_amount_cents > 0
              ? `Votre dépôt sera restitué : ${amountEur}€ par ${validated.restitution_method}.`
              : `Votre dépôt a été intégralement retenu (retenues justifiées).`,
          priority: "high",
          metadata: {
            deposit_id: depositId,
            lease_id: typedDeposit.lease_id,
            restitution_amount_cents: validated.restitution_amount_cents,
            retenue_cents: validated.retenue_cents,
          },
        });
      }

      // Emit event
      await serviceClient.from("outbox").insert({
        event_type: "Deposit.Restituted",
        payload: {
          deposit_id: depositId,
          lease_id: typedDeposit.lease_id,
          tenant_id: typedDeposit.tenant_id,
          restitution_amount_cents: validated.restitution_amount_cents,
          retenue_cents: validated.retenue_cents,
          late_penalty_cents: latePenaltyCents,
          method: validated.restitution_method,
          property_address: typedDeposit.lease?.property?.adresse_complete,
        },
      } as any);

      // Audit log
      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        action: "deposit_restituted",
        entity_type: "security_deposit",
        entity_id: depositId,
        metadata: {
          lease_id: typedDeposit.lease_id,
          restitution_amount_cents: validated.restitution_amount_cents,
          retenue_cents: validated.retenue_cents,
          retenue_details: validated.retenue_details,
          late_penalty_cents: latePenaltyCents,
          method: validated.restitution_method,
        },
      } as any);

      return NextResponse.json({
        deposit: updated,
        late_penalty_cents: latePenaltyCents,
      });
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
