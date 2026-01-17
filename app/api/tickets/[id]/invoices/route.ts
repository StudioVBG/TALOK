export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * POST /api/tickets/[tid]/invoices - Émettre une facture prestataire
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const formData = await request.formData();
    const amount = parseFloat(formData.get("amount") as string);
    const invoice_number = formData.get("invoice_number") as string;
    const invoice_date = formData.get("invoice_date") as string;
    const quote_id = formData.get("quote_id") as string;
    const file = formData.get("file") as File;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Montant requis et doit être positif" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est prestataire assigné
    const { data: ticket } = await supabaseClient
      .from("tickets")
      .select(`
        id,
        statut,
        work_orders!inner(provider_id, statut)
      `)
      .eq("id", params.id as any)
      .single();

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;

    if (profileData?.role !== "provider") {
      return NextResponse.json(
        { error: "Seuls les prestataires peuvent émettre des factures" },
        { status: 403 }
      );
    }

    const ticketData = ticket as any;
    const workOrder = ticketData.work_orders?.find((wo: any) => wo.provider_id === profileData.id);

    if (!workOrder || workOrder.statut !== "done") {
      return NextResponse.json(
        { error: "L'intervention doit être terminée avant facturation" },
        { status: 400 }
      );
    }

    // Uploader le fichier de facture si fourni
    let fileUrl = null;
    if (file) {
      const fileName = `provider-invoices/${params.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from("documents")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;
      fileUrl = uploadData.path;
    }

    // Créer la facture
    const { data: invoice, error } = await supabaseClient
      .from("provider_invoices")
      .insert({
        ticket_id: params.id as any,
        quote_id: quote_id || null,
        provider_id: profileData.id,
        amount,
        invoice_number: invoice_number || `INV-${Date.now()}`,
        invoice_date: invoice_date || new Date().toISOString().split("T")[0],
        file_url: fileUrl,
        status: "pending" as any,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const invoiceData = invoice as any;

    // Émettre un événement
    await supabaseClient.from("outbox").insert({
      event_type: "ProviderInvoice.Created",
      payload: {
        invoice_id: invoiceData.id,
        ticket_id: params.id,
        provider_id: profileData.id,
        amount,
      },
    } as any);

    return NextResponse.json({ invoice: invoiceData });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

