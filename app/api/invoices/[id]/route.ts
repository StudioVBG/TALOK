export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/helpers/api-error";
import { invoiceUpdateSchema } from "@/lib/validations";
import type { InvoiceUpdate, InvoiceRow, ProfileRow } from "@/lib/supabase/typed-client";

/**
 * GET /api/invoices/[id] - Récupérer une facture par ID
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;
    if (!invoice) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/invoices/[id] - Mettre à jour une facture
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = invoiceUpdateSchema.parse(body) as InvoiceUpdate;

    // Vérifier que l'utilisateur est propriétaire de la facture
    const { data: invoice } = await supabase
      .from("invoices")
      .select("owner_id")
      .eq("id", params.id)
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
        .eq("id", params.id)
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
      .eq("id", params.id)
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
  { params }: { params: { id: string } }
) {
  try {
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
      .eq("id", params.id)
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

    const { error } = await supabase.from("invoices").delete().eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

