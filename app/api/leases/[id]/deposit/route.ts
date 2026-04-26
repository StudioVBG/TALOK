export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/deposit - Encaisser un dépôt de garantie
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, proof_url, reason } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Montant requis et doit être positif" },
        { status: 400 }
      );
    }

    // Service-role pour la lecture (RLS cascade leases→properties).
    // Sécurité garantie par le check owner_id ci-dessous.
    const serviceClient = getServiceClient();

    const { data: lease } = await serviceClient
      .from("leases")
      .select(`
        id,
        property:properties(owner_id)
      `)
      .eq("id", id)
      .maybeSingle();

    if (!lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const leaseData = lease as { property?: { owner_id?: string } | null };
    const profileData = profile as { id: string; role: string } | null;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property?.owner_id === profileData?.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier le montant du dépôt dans le bail
    const { data: leaseDetails } = await serviceClient
      .from("leases")
      .select("depot_de_garantie")
      .eq("id", id)
      .maybeSingle();

    // Créer le mouvement d'encaissement
    const { data: movement, error } = await supabase
      .from("deposit_movements")
      .insert({
        lease_id: id as any,
        type: "encaissement",
        amount,
        reason: reason || "Dépôt de garantie",
        proof_url,
        status: "received",
        processed_at: new Date().toISOString(),
        processed_by: user.id,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const movementData = movement as any;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Deposit.Received",
      payload: {
        movement_id: movementData.id,
        lease_id: id as any,
        amount,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "deposit_received",
      entity_type: "deposit",
      entity_id: movementData.id,
      metadata: { amount, lease_id: id as any },
    } as any);

    // Accounting auto-entry (non-blocking, idempotent, gated by accounting_enabled)
    try {
      const { ensureDepositReceivedEntry } = await import(
        "@/lib/accounting/deposit-entry"
      );
      const result = await ensureDepositReceivedEntry(supabase, movementData.id, {
        userId: user.id,
      });
      if (result.skippedReason === "error") {
        console.error("[ACCOUNTING] deposit_received failed:", result.error);
      }
    } catch (accountingError) {
      console.error(
        "[ACCOUNTING] deposit_received hook exception (non-blocking):",
        accountingError,
      );
    }

    return NextResponse.json({ movement });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leases/[id]/deposit - Récupérer l'historique du dépôt
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Service-role + check métier explicite (locataire actif via roommates,
    // propriétaire via property, ou admin).
    const serviceClient = getServiceClient();

    const [{ data: roommate }, { data: profile }, { data: lease }] = await Promise.all([
      serviceClient
        .from("roommates")
        .select("id")
        .eq("lease_id", id)
        .eq("user_id", user.id)
        .is("left_on", null)
        .maybeSingle(),
      serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle(),
      serviceClient
        .from("leases")
        .select(`
          id,
          property:properties(owner_id)
        `)
        .eq("id", id)
        .maybeSingle(),
    ]);

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const leaseData = lease as { property?: { owner_id?: string } | null };
    const profileData = profile as { id: string; role: string } | null;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property?.owner_id === profileData?.id;
    const hasAccess = !!roommate || isOwner || isAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const { data: movements, error } = await serviceClient
      .from("deposit_movements")
      .select("*")
      .eq("lease_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const { data: balance } = await serviceClient
      .from("deposit_balance")
      .select("*")
      .eq("lease_id", id)
      .maybeSingle();

    return NextResponse.json({
      movements: movements || [],
      balance: balance || { balance: 0, total_received: 0, total_returned: 0 },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





