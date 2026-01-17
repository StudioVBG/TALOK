export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { invoiceSchema } from "@/lib/validations";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { invoicesQuerySchema, validateQueryParams } from "@/lib/validations/params";

/**
 * GET /api/invoices - Récupérer les factures de l'utilisateur
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // ✅ VALIDATION: Valider les query params
    const url = new URL(request.url);
    let queryParams;
    try {
      queryParams = validateQueryParams(invoicesQuerySchema, url.searchParams);
    } catch (validationError) {
      console.warn("[GET /api/invoices] Invalid query params, using defaults:", validationError);
      queryParams = {};
    }

    // ✅ PAGINATION: Récupérer les paramètres de pagination
    const page = parseInt(String(queryParams.page || "1"));
    const limit = Math.min(parseInt(String(queryParams.limit || "50")), 200); // Max 200
    const offset = (page - 1) * limit;

    // Récupérer le profil
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile || !("role" in profile)) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer les factures selon le rôle avec pagination et filtres
    let invoices: any[] | undefined;
    let totalCount: number | null = null;
    const supabaseClient = supabase as any;
    
    let baseQuery;
    
    if ((profile as any).role === "admin") {
      // Les admins voient toutes les factures
      baseQuery = supabaseClient
        .from("invoices")
        .select("*", { count: "exact" })
        .order("periode", { ascending: false });
    } else if ((profile as any).role === "owner") {
      // Les propriétaires voient leurs factures
      baseQuery = supabaseClient
        .from("invoices")
        .select("*", { count: "exact" })
        .eq("owner_id", (profile as any).id)
        .order("periode", { ascending: false });
    } else if ((profile as any).role === "tenant") {
      // Les locataires voient leurs factures
      baseQuery = supabaseClient
        .from("invoices")
        .select("*", { count: "exact" })
        .eq("tenant_id", (profile as any).id)
        .order("periode", { ascending: false });
    } else {
      invoices = [];
      baseQuery = null;
    }

    // ✅ FILTRES: Appliquer les filtres si fournis
    if (baseQuery) {
      if (queryParams.lease_id || queryParams.leaseId) {
        baseQuery = baseQuery.eq("lease_id", queryParams.lease_id || queryParams.leaseId);
      }
      if (queryParams.status) {
        baseQuery = baseQuery.eq("statut", queryParams.status);
      }
      if (queryParams.periode) {
        baseQuery = baseQuery.eq("periode", queryParams.periode);
      }

      // ✅ PAGINATION: Appliquer la pagination
      const { data, error, count } = await baseQuery.range(offset, offset + limit - 1);

      if (error) throw error;
      invoices = data;
      totalCount = count;
    }

    return NextResponse.json({ 
      invoices: invoices || [],
      pagination: {
        page,
        limit,
        total: totalCount || invoices?.length || 0,
      }
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices - Créer une nouvelle facture
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = invoiceSchema.parse(body);

    // Récupérer le profil
    const supabaseClient = supabase as any;
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile || !("role" in profile) || (profile as any).role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent créer des factures" },
        { status: 403 }
      );
    }

    // Récupérer le bail
    const { data: lease, error: leaseError } = await supabaseClient
      .from("leases")
      .select("*")
      .eq("id", validated.lease_id as any)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // Récupérer la propriété pour obtenir le propriétaire
    if (!lease || !("property_id" in lease) || !(lease as any).property_id) {
      return NextResponse.json(
        { error: "Le bail n'a pas de propriété associée" },
        { status: 400 }
      );
    }

    const { data: property, error: propertyError } = await supabaseClient
      .from("properties")
      .select("owner_id")
      .eq("id", (lease as any).property_id as any)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
    }

    // Vérifier que le propriétaire correspond
    if ((property as any).owner_id !== (profile as any).id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas propriétaire de ce bail" },
        { status: 403 }
      );
    }

    // Trouver le locataire principal
    const { data: signers, error: signersError } = await supabaseClient
      .from("lease_signers")
      .select("profile_id")
      .eq("lease_id", validated.lease_id as any)
      .eq("role", "locataire_principal" as any)
      .single();

    if (signersError || !signers) {
      return NextResponse.json(
        { error: "Locataire principal non trouvé" },
        { status: 404 }
      );
    }

    // Calculer le montant total
    const montant_total = validated.montant_loyer + validated.montant_charges;

    // Créer la facture
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .insert({
        lease_id: validated.lease_id,
        owner_id: (property as any).owner_id,
        tenant_id: (signers as any).profile_id,
        periode: validated.periode,
        montant_loyer: validated.montant_loyer,
        montant_charges: validated.montant_charges,
        montant_total,
        statut: "draft",
      } as any)
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Émettre un événement
    await supabaseClient.from("outbox").insert({
      event_type: "Rent.InvoiceIssued",
      payload: {
        invoice_id: invoice.id,
        lease_id: validated.lease_id,
        periode: validated.periode,
        montant_total: montant_total,
      },
    } as any);

    // Journaliser
    await supabaseClient.from("audit_log").insert({
      user_id: user.id,
      action: "invoice_created",
      entity_type: "invoice",
      entity_id: invoice.id,
      metadata: { periode: validated.periode, montant_total: montant_total },
    } as any);

    return NextResponse.json({ invoice });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

