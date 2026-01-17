export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * @deprecated Utiliser POST /api/exports avec type='accounting' pour un export asynchrone sécurisé.
 * GET /api/accounting/exports - Exporter la comptabilité (CSV/Excel)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "owner"; // 'global' | 'owner'
    const period = searchParams.get("period"); // 'YYYY-MM'
    const format = searchParams.get("format") || "csv"; // 'csv' | 'excel' | 'fec'

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";

    if (scope === "global" && !isAdmin) {
      return NextResponse.json(
        { error: "Seul l'admin peut exporter la comptabilité globale" },
        { status: 403 }
      );
    }

    // Construire la requête selon le scope
    let invoicesQuery = supabase
      .from("invoices")
      .select(`
        *,
        lease:leases!inner(
          id,
          property:properties!inner(id, adresse_complete, owner_id)
        )
      `);

    if (scope === "owner") {
      invoicesQuery = invoicesQuery.eq("lease.property.owner_id", profileData?.id as any);
    }

    if (period) {
      // @ts-ignore - Supabase typing issue
      invoicesQuery = invoicesQuery.eq("periode", period);
    }

    const { data: invoices, error: invoicesError } = await invoicesQuery;

    if (invoicesError) throw invoicesError;

    // Récupérer les paiements
    const invoiceIds = invoices?.map((i: any) => i.id) || [];
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .in("invoice_id", invoiceIds);

    // Formater les données selon le format
    let exportData: any;
    if (format === "fec") {
      // Format FEC (Fichier des Écritures Comptables)
      exportData = formatFEC(invoices || [], payments || []);
    } else {
      // Format CSV simple
      exportData = formatCSV(invoices || [], payments || []);
    }

    return NextResponse.json({
      data: exportData,
      format,
      period,
      scope,
      count: invoices?.length || 0,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

function formatCSV(invoices: any[], payments: any[]): string {
  const rows = ["Date,Type,Libellé,Montant,Statut"];
  for (const invoice of invoices) {
    rows.push(
      `${invoice.periode},Facture,${invoice.lease?.property?.adresse_complete || ""},${invoice.montant_total},${invoice.statut}`
    );
  }
  for (const payment of payments) {
    rows.push(
      `${payment.date_paiement},Paiement,${payment.moyen},${payment.montant},${payment.statut}`
    );
  }
  return rows.join("\n");
}

function formatFEC(invoices: any[], payments: any[]): any[] {
  // Format FEC simplifié (à compléter selon spécifications)
  const entries: any[] = [];
  for (const invoice of invoices) {
    entries.push({
      JournalCode: "VT",
      JournalLib: "Ventes",
      EcritureDate: invoice.periode + "-01",
      EcritureNum: invoice.id.substring(0, 8),
      CompteNum: "706000",
      CompteLib: "Ventes de produits finis",
      Debit: invoice.montant_total,
      Credit: 0,
    });
  }
  return entries;
}

