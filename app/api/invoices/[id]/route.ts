export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
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

    // ✅ SOTA: Service client pour bypass RLS — autorisation vérifiée côté app
    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: invoice, error } = await serviceClient
      .from("invoices")
      .select(`
        *,
        lease:leases(
          id,
          type_bail,
          property:properties(
            id,
            adresse_complete,
            owner_id,
            legal_entity_id
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

    const invoiceAny = invoice as any;
    const isAdmin = profile.role === "admin";
    const isOwner = invoiceAny.owner_id === profile.id;
    const isTenant = invoiceAny.tenant_id === profile.id;

    // Vérifier l'accès via entity_members (SCI) si ni direct owner ni tenant
    let isSciMember = false;
    if (!isAdmin && !isOwner && !isTenant) {
      const entityId =
        invoiceAny.entity_id ||
        invoiceAny.lease?.property?.legal_entity_id ||
        null;
      if (entityId) {
        const { data: membership } = await serviceClient
          .from("entity_members")
          .select("id")
          .eq("entity_id", entityId)
          .eq("user_id", user.id)
          .maybeSingle();
        isSciMember = !!membership;
      }
    }

    if (!isAdmin && !isOwner && !isTenant && !isSciMember) {
      return NextResponse.json(
        { error: "Accès refusé à cette facture" },
        { status: 403 }
      );
    }

    const { data: payments } = await serviceClient
      .from("payments")
      .select("id, montant, moyen, date_paiement, statut")
      .eq("invoice_id", id)
      .order("date_paiement", { ascending: false });

    const settlement = await getInvoiceSettlement(serviceClient as any, id);

    // Bug 10 : `date_emission` ne doit jamais être postérieure à `date_echeance`.
    // Quand une facture est créée rétroactivement (cron lancé tardivement), la
    // base stocke `created_at = now()` mais l'échéance dans le passé. On clamp
    // `date_emission` à min(date_emission||created_at, date_echeance) pour
    // afficher des dates cohérentes côté UI.
    const rawIssued = invoiceAny.date_emission || invoiceAny.created_at || null;
    const rawDue = invoiceAny.date_echeance || invoiceAny.due_date || null;
    let normalizedIssued = rawIssued;
    if (rawIssued && rawDue) {
      const issuedTs = new Date(rawIssued).getTime();
      const dueTs = new Date(rawDue).getTime();
      if (Number.isFinite(issuedTs) && Number.isFinite(dueTs) && issuedTs > dueTs) {
        normalizedIssued = rawDue;
      }
    }

    return NextResponse.json({
      invoice: {
        ...invoiceAny,
        date_echeance: rawDue,
        date_emission: normalizedIssued,
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

    const serviceClient = getServiceClient();

    // Vérifier que l'utilisateur est propriétaire de la facture
    const { data: invoice } = await serviceClient
      .from("invoices")
      .select("owner_id")
      .eq("id", id)
      .single();

    const invoiceData = invoice as Pick<InvoiceRow, "owner_id"> | null;
    if (!invoiceData) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    const { data: profile } = await serviceClient
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
      const { data: currentInvoice } = await serviceClient
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

    const { data: updatedInvoice, error } = await serviceClient
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

    const serviceClient = getServiceClient();

    // Vérifier que l'utilisateur est propriétaire de la facture
    const { data: invoice } = await serviceClient
      .from("invoices")
      .select("owner_id")
      .eq("id", id)
      .single();

    const invoiceData = invoice as Pick<InvoiceRow, "owner_id"> | null;
    if (!invoiceData) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    const { data: profile } = await serviceClient
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

    const { error } = await serviceClient.from("invoices").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

