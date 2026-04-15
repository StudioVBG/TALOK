export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/cash-receipt/[id]
 * Récupère les détails d'un reçu espèces pour affichage
 * (propriétaire, locataire ou admin)
 */

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Filet défensif : un id non-UUID (ex. "undefined" suite à un bug côté
    // client) ferait remonter une erreur Postgres 22P02 qui serait ensuite
    // encapsulée en 500. On retourne un 404 clair à la place.
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Identifiant de reçu invalide" },
        { status: 404 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: receipt, error } = await serviceClient
      .from("cash_receipts")
      .select(`
        *,
        invoice:invoices(id, periode, montant_total, statut),
        owner:profiles!cash_receipts_owner_id_fkey(id, prenom, nom),
        tenant:profiles!cash_receipts_tenant_id_fkey(id, prenom, nom),
        property:properties(id, adresse_complete)
      `)
      .eq("id", id)
      .single();

    if (error || !receipt) {
      return NextResponse.json({ error: "Reçu non trouvé" }, { status: 404 });
    }

    // Autorisation: propriétaire, locataire ou admin
    const receiptAny = receipt as any;
    const isOwner = receiptAny.owner_id === profile.id;
    const isTenant = receiptAny.tenant_id === profile.id;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isTenant && !isAdmin) {
      return NextResponse.json(
        { error: "Accès refusé à ce reçu" },
        { status: 403 }
      );
    }

    return NextResponse.json({ receipt: receiptAny });
  } catch (error: unknown) {
    console.error("Erreur GET cash-receipt:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
