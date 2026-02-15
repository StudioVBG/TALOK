import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe-client";
import type { Invoice, InvoicesResponse } from "@/types/billing";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({
        invoices: [],
        has_more: false,
        next_cursor: null,
      } satisfies InvoicesResponse);
    }

    const { searchParams } = new URL(request.url);
    const startingAfter = searchParams.get("starting_after") || undefined;

    const stripe = getStripe();
    const stripeInvoices = await stripe.invoices.list({
      customer: subscription.stripe_customer_id,
      limit: 10,
      starting_after: startingAfter,
    });

    const invoices: Invoice[] = stripeInvoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number || `TALOK-${inv.id.slice(-8).toUpperCase()}`,
      status: (inv.status || "draft") as Invoice["status"],
      amount_ht: inv.subtotal || 0,
      amount_tva: (inv as any).tax || 0,
      amount_ttc: inv.total || 0,
      tva_taux: (inv as any).tax_percent || 20,
      period_start: inv.period_start
        ? new Date(inv.period_start * 1000).toISOString()
        : new Date().toISOString(),
      period_end: inv.period_end
        ? new Date(inv.period_end * 1000).toISOString()
        : new Date().toISOString(),
      pdf_url: inv.invoice_pdf || null,
      hosted_url: inv.hosted_invoice_url || null,
      paid_at: inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
        : null,
      created_at: new Date(inv.created * 1000).toISOString(),
    }));

    // Sync to Supabase (fire and forget)
    for (const invoice of invoices) {
      supabase
        .from("subscription_invoices")
        .upsert({
          id: invoice.id,
          owner_id: user.id,
          stripe_invoice_id: invoice.id,
          invoice_number: invoice.number,
          subtotal: invoice.amount_ht,
          tax: invoice.amount_tva,
          total: invoice.amount_ttc,
          status: invoice.status,
          invoice_pdf_url: invoice.pdf_url,
          hosted_invoice_url: invoice.hosted_url,
          period_start: invoice.period_start,
          period_end: invoice.period_end,
          paid_at: invoice.paid_at,
          created_at: invoice.created_at,
        }, { onConflict: "id" })
        .then(() => {});
    }

    const lastInvoice = stripeInvoices.data[stripeInvoices.data.length - 1];

    return NextResponse.json({
      invoices,
      has_more: stripeInvoices.has_more,
      next_cursor: stripeInvoices.has_more && lastInvoice ? lastInvoice.id : null,
    } satisfies InvoicesResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
