export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { ensureInitialInvoiceForLease } from "@/lib/services/lease-initial-invoice.service";

/**
 * POST /api/leases/[id]/retry-invoice
 *
 * Retries initial invoice generation for a lease that is fully_signed or active
 * but missing its initial invoice. Called automatically by the self-healing
 * mechanism in fetchLeaseDetails.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Verify lease exists and is in a valid state
    const { data: lease } = await serviceClient
      .from("leases")
      .select("id, statut, property:properties!leases_property_id_fkey(owner_id)")
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // Only allow for fully_signed or active leases
    const validStatuses = ["fully_signed", "active"];
    if (!validStatuses.includes((lease as any).statut)) {
      return NextResponse.json(
        { error: `Bail en statut "${(lease as any).statut}" — génération non applicable` },
        { status: 400 }
      );
    }

    // Verify caller is the owner
    const ownerProfileId = (lease as any).property?.owner_id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || profile.id !== ownerProfileId) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const result = await ensureInitialInvoiceForLease(
      serviceClient as unknown as Parameters<typeof ensureInitialInvoiceForLease>[0],
      leaseId
    );

    return NextResponse.json({
      success: true,
      invoiceId: result.invoiceId,
      created: result.created,
      amount: result.amount,
    });
  } catch (err) {
    console.error("[retry-invoice] Error:", String(err));
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
