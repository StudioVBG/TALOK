export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/helpers/api-error";
import { invoiceSchema } from "@/lib/validations";
import type { InvoiceUpdate, InvoiceRow, ProfileRow } from "@/lib/supabase/typed-client";
import { getInvoiceSettlement } from "@/lib/services/invoice-status.service";

/**
 * GET /api/invoices/[id] - Récupérer une facture par ID
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Note: we no longer fetch the profile here. Authorization is enforced
    // by RLS on the invoices SELECT policy (see
    // supabase/migrations/20260410204528_extend_invoices_rls_for_sci_access.sql).
    // If the user is not allowed to see this invoice, RLS returns no row and
    // the PGRST116 error is translated to 404 by handleApiError.
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        *,
        lease:leases(
          id,
          type_bail,
          property:properties(
            id,
            adresse_complete
          )
        ),
        tenant:profiles!invoices_tenant_id_fkey(
          id,
          prenom,
          nom,
          email
        ),
        owner:profiles!invoices_owner_id_fkey(
          id,
          prenom,
          nom
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!invoice) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    // Authorization is enforced by RLS (SELECT policy on invoices):
    //   - direct owner: invoices.owner_id === user_profile_id()
    //   - SCI member:   invoices.entity_id ∈ entity_members(user_id=auth.uid())
    //                   OR invoices.lease → property.legal_entity_id ∈ …
    //   - tenant:       invoices.tenant_id === user_profile_id()
    //   - admin:        dedicated RLS policy
    // If the query returned a row, the caller is authorized. No redundant
    // application-level check here (the previous one blocked legitimate SCI
    // members whose profile.id ≠ invoices.owner_id — see bug #3 audit).
    const invoiceAny = invoice as any;

    const { data: payments } = await supabase
      .from("payments")
      .select("id, montant, moyen, date_paiement, statut")
      .eq("invoice_id", id)
      .order("date_paiement", { ascending: false });

    const settlement = await getInvoiceSettlement(supabase as any, id);

    return NextResponse.json({
      invoice: {
        ...invoiceAny,
        date_echeance: invoiceAny.date_echeance || invoiceAny.due_date || null,
        date_emission: invoiceAny.date_emission || invoiceAny.created_at || null,
        property: invoiceAny.lease?.property || null,
        payments: payments || [],
        montant_paye: settlement?.totalPaid || 0,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/invoices/[id] - Mettre à jour une facture
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = invoiceSchema.partial().parse(body) as InvoiceUpdate;

    // Vérifier que l'utilisateur est propriétaire de la facture
    const { data: invoice } = await supabase
      .from("invoices")
      .select("owner_id")
      .eq("id", id)
      .single();

    const invoiceData = invoice as Pick<InvoiceRow, "owner_id"> | null;
    if (!invoiceData) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as ProfileRow | null;
    if (!profileData || (profileData.role !== "admin" && profileData.id !== invoiceData.owner_id)) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier cette facture" },
        { status: 403 }
      );
    }

    // Recalculer le montant total si nécessaire
    if (validated.montant_loyer !== undefined || validated.montant_charges !== undefined) {
      const { data: currentInvoice } = await supabase
        .from("invoices")
        .select("montant_loyer, montant_charges")
        .eq("id", id)
        .single();

      const currentInvoiceData = currentInvoice as InvoiceRow | null;
      if (currentInvoiceData) {
        const montant_loyer = validated.montant_loyer ?? currentInvoiceData.montant_loyer;
        const montant_charges = validated.montant_charges ?? currentInvoiceData.montant_charges;
        (validated as InvoiceUpdate).montant_total = montant_loyer + montant_charges;
      }
    }

    const { data: updatedInvoice, error } = await supabase
      .from("invoices")
      .update(validated)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/invoices/[id] - Supprimer une facture
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est propriétaire de la facture
    const { data: invoice } = await supabase
      .from("invoices")
      .select("owner_id")
      .eq("id", id)
      .single();

    const invoiceData = invoice as Pick<InvoiceRow, "owner_id"> | null;
    if (!invoiceData) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as ProfileRow | null;
    if (!profileData || (profileData.role !== "admin" && profileData.id !== invoiceData.owner_id)) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de supprimer cette facture" },
        { status: 403 }
      );
    }

    const { error } = await supabase.from("invoices").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

