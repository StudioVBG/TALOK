export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  requireRole,
  validateBody,
  logAudit,
  checkIdempotency,
  storeIdempotency,
} from "@/lib/api/middleware";
import { CreateInvoiceSchema } from "@/lib/api/schemas";

interface RouteParams {
  params: Promise<{ lid: string }>;
}

/**
 * POST /api/v1/leases/:lid/rent-invoices
 * Create rent invoice for a lease
 * Events: Rent.InvoiceIssued
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { lid } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const supabase = await createClient();

    // Check idempotency
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      const cached = await checkIdempotency(supabase, idempotencyKey, "invoice");
      if (cached) {
        return new Response(JSON.stringify(cached.cached.response_body), {
          status: cached.cached.response_status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Get lease with property
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        *,
        properties!inner(owner_id),
        lease_signers(profile_id, role)
      `)
      .eq("id", lid)
      .single();

    if (leaseError || !lease) {
      return apiError("Bail non trouvé", 404);
    }

    // Verify ownership
    if (auth.profile.role === "owner" && lease.properties.owner_id !== auth.profile.id) {
      return apiError("Accès non autorisé", 403);
    }

    // Check lease is active
    if (lease.statut !== "active") {
      return apiError("Le bail doit être actif pour émettre une facture", 400);
    }

    const body = await request.json();

    // Use lease values if not provided
    const periode = body.periode || new Date().toISOString().slice(0, 7);
    const montantLoyer = body.montant_loyer ?? lease.loyer;
    const montantCharges = body.montant_charges ?? lease.charges_forfaitaires;
    const montantTotal = montantLoyer + montantCharges;

    // Check for existing invoice for this period
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("lease_id", lid)
      .eq("periode", periode)
      .single();

    if (existingInvoice) {
      return apiError("Une facture existe déjà pour cette période", 409, "DUPLICATE_INVOICE");
    }

    // Find tenant
    const tenant = (lease.lease_signers || []).find(
      (s: any) => s.role === "locataire_principal"
    );

    if (!tenant) {
      return apiError("Aucun locataire principal trouvé", 400);
    }

    // Create invoice
    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        lease_id: lid,
        owner_id: auth.profile.id,
        tenant_id: tenant.profile_id,
        periode,
        montant_loyer: montantLoyer,
        montant_charges: montantCharges,
        montant_total: montantTotal,
        statut: "sent",
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /rent-invoices] Error:", error);
      return apiError("Erreur lors de la création", 500);
    }

    // Emit event
    await supabase.from("outbox").insert({
      event_type: "Rent.InvoiceIssued",
      payload: {
        invoice_id: invoice.id,
        lease_id: lid,
        tenant_id: tenant.profile_id,
        amount: montantTotal,
        periode,
      },
    });

    // TODO: Send email notification to tenant

    // Audit log
    await logAudit(
      supabase,
      "invoice.created",
      "invoices",
      invoice.id,
      auth.user.id,
      null,
      invoice
    );

    const response = { invoice };

    // Store idempotency
    if (idempotencyKey) {
      await storeIdempotency(supabase, idempotencyKey, "invoice", response, 201);
    }

    return apiSuccess(response, 201);
  } catch (error: unknown) {
    console.error("[POST /rent-invoices] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

