export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authenticateAPIKey,
  requireScope,
  addRateLimitHeaders,
} from "@/lib/api/api-key-auth";
import { apiError, apiSuccess, getPaginationParams } from "@/lib/api/middleware";

/**
 * GET /api/v1/payments
 * List payments for the owner's properties
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    if (auth instanceof Response) return auth;

    const scopeCheck = requireScope(auth, "payments");
    if (scopeCheck) return scopeCheck;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = getPaginationParams(searchParams);

    const status = searchParams.get("status");
    const leaseId = searchParams.get("lease_id");
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to = searchParams.get("to");     // YYYY-MM-DD

    // Get owner's properties
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", auth.profileId);

    if (!properties || properties.length === 0) {
      return apiSuccess({ payments: [], pagination: { page, limit, total: 0, total_pages: 0 } });
    }

    const propertyIds = properties.map((p: any) => p.id);

    // Get leases for those properties
    const { data: leases } = await supabase
      .from("leases")
      .select("id")
      .in("property_id", propertyIds);

    if (!leases || leases.length === 0) {
      return apiSuccess({ payments: [], pagination: { page, limit, total: 0, total_pages: 0 } });
    }

    const leaseIds = leases.map((l: any) => l.id);

    // Get invoices for those leases
    let invoicesQuery = supabase
      .from("invoices")
      .select("id")
      .in("lease_id", leaseIds);

    if (leaseId && leaseIds.includes(leaseId)) {
      invoicesQuery = invoicesQuery.eq("lease_id", leaseId);
    }

    const { data: invoices } = await invoicesQuery;

    if (!invoices || invoices.length === 0) {
      return apiSuccess({ payments: [], pagination: { page, limit, total: 0, total_pages: 0 } });
    }

    const invoiceIds = invoices.map((i: any) => i.id);

    // Get payments
    // Columns are French on the `payments` table — there is no
    // `stripe_payment_id`; the canonical column is `provider_ref`
    // (stores Stripe PaymentIntent IDs as well as manual references).
    let query = supabase
      .from("payments")
      .select(`
        id, invoice_id, montant, moyen, statut, provider_ref, date_paiement, created_at, updated_at,
        invoices!inner(id, lease_id, periode, montant_loyer, montant_charges)
      `, { count: "exact" })
      .in("invoice_id", invoiceIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("statut", status);
    }
    if (from) {
      query = query.gte("created_at", `${from}T00:00:00Z`);
    }
    if (to) {
      query = query.lte("created_at", `${to}T23:59:59Z`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /v1/payments] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    const response = apiSuccess({
      payments: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });

    return addRateLimitHeaders(response, auth);
  } catch (error: unknown) {
    console.error("[GET /v1/payments] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}
