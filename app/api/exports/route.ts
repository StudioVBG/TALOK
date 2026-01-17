export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ExportService } from "@/lib/services/export.service";
import { ExportPolicy } from "@/lib/services/export-policy.service";

/**
 * POST /api/exports - Créer un job d'export
 * Body: { type, format, filters }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { type, format, filters } = body;

    if (!type || !format) {
      return NextResponse.json({ error: "Type et format requis" }, { status: 400 });
    }

    // 1. Vérifier la politique d'accès
    const canExport = await ExportPolicy.canExport(user.id, type, filters);
    if (!canExport) {
      return NextResponse.json({ error: "Accès non autorisé à cet export" }, { status: 403 });
    }

    // Récupérer le profil pour les requêtes de données
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    let dataToExport: any[] = [];
    let columns: string[] = [];

    // Logique spécifique par type d'export
    if (type === "accounting") {
      const isAdmin = profile.role === "admin";
      const scope = filters?.scope || "owner";
      const period = filters?.period;

      if (scope === "global" && !isAdmin) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      let query = supabase
        .from("invoices")
        .select(`
          periode, montant_total, montant_loyer, montant_charges, statut,
          lease:leases!inner(
            property:properties!inner(adresse_complete, owner_id)
          )
        `);

      if (scope === "owner") {
        query = query.eq("lease.property.owner_id", profile.id);
      }

      if (period) {
        query = query.eq("periode", period);
      }

      const { data: invoices, error } = await query;
      if (error) throw error;

      dataToExport = invoices.map((inv: any) => ({
        date: inv.periode,
        type: "Facture",
        description: inv.lease?.property?.adresse_complete,
        montant: inv.montant_total,
        loyer: inv.montant_loyer,
        charges: inv.montant_charges,
        statut: inv.statut
      }));

      columns = ["date", "type", "description", "montant", "loyer", "charges", "statut"];
    } else if (type === "invoice") {
      const invoiceId = filters?.invoiceId;
      if (!invoiceId) return NextResponse.json({ error: "invoiceId requis" }, { status: 400 });

      const { data: invoice, error } = await supabase
        .from("invoices")
        .select(`
          id, periode, montant_total, montant_loyer, montant_charges, statut,
          lease:leases!inner(
            property:properties!inner(owner_id)
          )
        `)
        .eq("id", invoiceId)
        .single();

      if (error || !invoice) return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });

      const isOwner = invoice.lease?.property?.owner_id === profile.id;
      const isAdmin = profile.role === "admin";
      // Manque check tenant ici, mais simplifié pour l'exemple

      if (!isOwner && !isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

      dataToExport = [{
        id: invoice.id,
        periode: invoice.periode,
        loyer: invoice.montant_loyer,
        charges: invoice.montant_charges,
        total: invoice.montant_total,
        statut: invoice.statut
      }];

      columns = ["id", "periode", "loyer", "charges", "total", "statut"];
    } else {
      return NextResponse.json({ error: "Type d'export non supporté" }, { status: 400 });
    }

    // Lancer le job d'export via le service
    const jobId = await ExportService.startExport({
      userId: user.id,
      type,
      format,
      data: dataToExport,
      columns
    });

    return NextResponse.json({ jobId, status: "processing" });
  } catch (error: unknown) {
    console.error("Export error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

