export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * @deprecated Utiliser POST /api/exports avec type='invoice' pour un export asynchrone sécurisé.
 * GET /api/invoices/[iid]/export - Exporter une facture en CSV (BTN-U03)
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

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv"; // csv, json

    // Récupérer la facture
    const { data: invoice } = await supabase
      .from("invoices")
      .select(`
        *,
        lease:leases!inner(
          id,
          property:properties!inner(owner_id)
        )
      `)
      .eq("id", params.id as any)
      .single();

    if (!invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const invoiceData = invoice as any;
    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = invoiceData.lease?.property?.owner_id === profileData?.id;

    // Vérifier l'accès (owner, tenant du bail, ou admin)
    let hasAccess = isOwner || isAdmin;
    if (!hasAccess && invoiceData.lease_id) {
      const { data: roommate } = await supabase
        .from("roommates")
        .select("id")
        .eq("lease_id", invoiceData.lease_id)
        .eq("user_id", user.id as any)
        .maybeSingle();
      hasAccess = !!roommate;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    if (format === "csv") {
      // Générer CSV
      const csv = [
        "Facture ID,Période,Montant Loyer,Montant Charges,Montant Total,Statut",
        `${invoiceData.id},${invoiceData.periode},${invoiceData.montant_loyer},${invoiceData.montant_charges},${invoiceData.montant_total},${invoiceData.statut}`,
      ].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="facture-${params.id}.csv"`,
        },
      });
    } else if (format === "json") {
      return NextResponse.json(invoiceData, {
        headers: {
          "Content-Disposition": `attachment; filename="facture-${params.id}.json"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Format non supporté" },
      { status: 400 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

