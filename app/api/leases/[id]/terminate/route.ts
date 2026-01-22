export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/leases/[id]/terminate - Terminer un bail (P1-2)
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

    // Récupérer le bail
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        statut,
        property:properties!inner(owner_id)
      `)
      .eq("id", id as any)
      .single();

    if (!lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const leaseData = lease as any;
    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = leaseData.property?.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    if (leaseData.statut === "terminated") {
      return NextResponse.json(
        { error: "Le bail est déjà terminé" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { termination_date, reason } = body;

    // Terminer le bail
    const { data: updated, error } = await supabase
      .from("leases")
      .update({
        statut: "terminated",
        date_fin: termination_date || new Date().toISOString().split("T")[0],
      } as any)
      .eq("id", id as any)
      .select()
      .single();

    if (error) throw error;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Lease.Terminated",
      payload: {
        lease_id: id as any,
        termination_date: termination_date || new Date().toISOString().split("T")[0],
        reason,
        terminated_by: user.id,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "lease_terminated",
      entity_type: "lease",
      entity_id: id,
      metadata: { termination_date, reason },
    } as any);

    return NextResponse.json({ lease: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





