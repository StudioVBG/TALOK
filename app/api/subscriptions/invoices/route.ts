export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/subscriptions/invoices
 * Récupère les factures de l'utilisateur
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { NextRequest, NextResponse } from "next/server";

const EMPTY_RESPONSE = (limit: number, offset: number) =>
  NextResponse.json({ invoices: [], total: 0, limit, offset });

function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703") return true;
  return typeof error.message === "string" && error.message.includes("does not exist");
}

type InvoiceRow = {
  id: string;
  subscription_id: string | null;
  stripe_invoice_id: string | null;
  status: string;
  amount_due: number | null;
  amount_paid: number | null;
  amount_remaining: number | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};

function mapInvoice(row: InvoiceRow, ownerId: string) {
  const total = row.amount_due ?? 0;
  return {
    id: row.id,
    subscription_id: row.subscription_id,
    owner_id: ownerId,
    stripe_invoice_id: row.stripe_invoice_id,
    invoice_number: row.stripe_invoice_id,
    subtotal: total,
    discount: 0,
    tax: 0,
    total,
    amount_paid: row.amount_paid ?? 0,
    amount_due: row.amount_remaining ?? total - (row.amount_paid ?? 0),
    currency: "EUR",
    status: row.status,
    invoice_pdf_url: row.invoice_pdf,
    hosted_invoice_url: row.hosted_invoice_url,
    period_start: row.period_start,
    period_end: row.period_end,
    due_date: row.due_date,
    paid_at: row.paid_at,
    lines: [],
    metadata: {},
    created_at: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "12")));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Service role : évite la récursion RLS 42P17 sur profiles/subscriptions
    const serviceClient = createServiceRoleClient();

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return EMPTY_RESPONSE(limit, offset);
    }

    const { data: subscriptions, error: subsError } = await serviceClient
      .from("subscriptions")
      .select("id")
      .eq("owner_id", profile.id);

    if (subsError) {
      if (isMissingSchemaError(subsError)) {
        return EMPTY_RESPONSE(limit, offset);
      }
      console.error("[Invoices GET] subscriptions query error:", subsError);
      return EMPTY_RESPONSE(limit, offset);
    }

    const subscriptionIds = ((subscriptions || []) as Array<{ id: string }>).map((s) => s.id);
    if (subscriptionIds.length === 0) {
      return EMPTY_RESPONSE(limit, offset);
    }

    const { data: invoices, error, count } = await serviceClient
      .from("subscription_invoices")
      .select("*", { count: "exact" })
      .in("subscription_id", subscriptionIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (isMissingSchemaError(error)) {
        console.warn("[Invoices GET] subscription_invoices schema issue, returning empty results");
        return EMPTY_RESPONSE(limit, offset);
      }
      console.error("[Invoices GET] query error:", error);
      return EMPTY_RESPONSE(limit, offset);
    }

    const mapped = ((invoices || []) as InvoiceRow[]).map((row) => mapInvoice(row, profile.id as string));

    return NextResponse.json({
      invoices: mapped,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AuthApiError') {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    console.error("[Invoices GET]", error);
    // Ne jamais 500 côté UI : retourner une liste vide pour ne pas casser la page "Mon forfait"
    return EMPTY_RESPONSE(limit, offset);
  }
}
