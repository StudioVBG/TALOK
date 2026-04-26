/**
 * API Route: Tenant unpaid-risk scoring
 * GET /api/accounting/scoring/[leaseId]
 *
 * Returns the risk score (0-100), the band, contributing factors and
 * recommended next actions for a given lease, computed from the full
 * invoice + payments history.
 *
 * Auth: admin / owner / agency. The owner must own the underlying
 * property; the agency must be the mandant.
 *
 * Feature gate: scoring (Pro+).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import {
  scoreTenantPayments,
  type ScoringInvoice,
} from "@/lib/accounting/unpaid-scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface InvoiceRow {
  id: string;
  due_date: string | null;
  date_echeance: string | null;
  periode: string | null;
  montant_total: number | null;
  payments: Array<{ montant: number | null; date_paiement: string | null }>;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leaseId: string }> },
) {
  try {
    const { leaseId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Profil introuvable");
    if (
      profile.role !== "admin" &&
      profile.role !== "owner" &&
      profile.role !== "agency"
    ) {
      throw new ApiError(403, "Acces refuse");
    }

    const featureGate = await requireAccountingAccess(profile.id, "scoring");
    if (featureGate) return featureGate;

    // Fetch lease + property + invoices to enforce scoping and feed the scorer
    const { data: lease } = await supabase
      .from("leases")
      .select(
        `
          id,
          tenant_id,
          property:properties!inner(id, owner_id, legal_entity_id, adresse_complete)
        `,
      )
      .eq("id", leaseId)
      .maybeSingle();

    if (!lease) throw new ApiError(404, "Bail introuvable");
    const propertyData = (lease as unknown as {
      property: {
        owner_id: string;
        legal_entity_id: string;
        adresse_complete: string | null;
      };
    }).property;

    if (profile.role === "owner") {
      if (propertyData.owner_id !== profile.id) {
        throw new ApiError(403, "Ce bail n'appartient pas a votre portefeuille");
      }
    }
    // For agency: rely on RLS - the select above already returned null if
    // the lease is not in the agency's mandant scope.

    const { data: invoices } = await supabase
      .from("invoices")
      .select(
        `
          id,
          due_date,
          date_echeance,
          periode,
          montant_total,
          payments(montant, date_paiement)
        `,
      )
      .eq("lease_id", leaseId)
      .order("date_echeance", { ascending: true });

    const rows = (invoices ?? []) as unknown as InvoiceRow[];

    const scoringInvoices: ScoringInvoice[] = rows.map((inv) => {
      const dueDate =
        inv.due_date ??
        inv.date_echeance ??
        (inv.periode ? `${inv.periode}-05` : new Date().toISOString().split("T")[0]);
      const amountDueCents = Math.round((inv.montant_total ?? 0) * 100);
      const amountPaidCents = (inv.payments ?? []).reduce(
        (sum, p) => sum + Math.round((p.montant ?? 0) * 100),
        0,
      );
      const lastPayment = (inv.payments ?? [])
        .map((p) => p.date_paiement)
        .filter((d): d is string => !!d)
        .sort()
        .pop();
      const paidAt =
        amountPaidCents >= amountDueCents && lastPayment ? lastPayment : null;

      return {
        invoiceId: inv.id,
        dueDate,
        amountDueCents,
        amountPaidCents,
        paidAt,
        periode: inv.periode ?? undefined,
      };
    });

    const result = scoreTenantPayments(scoringInvoices);

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        lease_id: leaseId,
        property: propertyData?.adresse_complete ?? null,
        invoice_count: scoringInvoices.length,
        generated_at: new Date().toISOString(),
        disclaimer:
          "Score indicatif base sur l'historique de paiement. Aucune decision automatisee ne doit etre prise sur cette seule base.",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
