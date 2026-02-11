export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { createLeaseStateMachine, type LeaseTransitionName } from "@/lib/services/lease-state-machine.service";

/**
 * GET /api/leases/[id]/transitions
 *
 * Retourne les transitions possibles depuis l'état actuel du bail,
 * avec les conditions (guards) évaluées.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const stateMachine = createLeaseStateMachine(serviceClient);

    const context = await stateMachine.buildContext(leaseId);
    if (!context) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const transitions = stateMachine.getAvailableTransitions(context);

    return NextResponse.json({
      lease_id: leaseId,
      current_status: context.currentStatus,
      context: {
        signers_count: context.signersCount,
        owner_signer: context.ownerSignerExists,
        tenant_signer: context.tenantSignerExists,
        all_signed: context.allSignersSigned,
        edl_entree_exists: context.edlEntreeExists,
        edl_entree_signed: context.edlEntreeSigned,
        keys_handed_over: context.keysHandedOver,
        insurance_valid: context.insuranceValid,
        date_debut_reached: context.dateDebutReached,
        notice_exists: context.noticeExists,
      },
      transitions,
    });
  } catch (error: unknown) {
    console.error("[GET transitions] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leases/[id]/transitions
 *
 * Exécute une transition d'état sur le bail.
 *
 * Body: { transition: LeaseTransitionName, force?: boolean, metadata?: object }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que l'utilisateur est le propriétaire
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut déclencher des transitions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { transition, force = false, metadata = {} } = body;

    const validTransitions: LeaseTransitionName[] = [
      "INITIATE_SIGNATURE", "MARK_FULLY_SIGNED", "ACTIVATE",
      "GIVE_NOTICE", "TERMINATE", "ARCHIVE", "CANCEL",
    ];

    if (!validTransitions.includes(transition)) {
      return NextResponse.json(
        { error: `Transition invalide : ${transition}`, valid: validTransitions },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();
    const stateMachine = createLeaseStateMachine(serviceClient);

    const result = await stateMachine.executeTransition(
      leaseId,
      transition as LeaseTransitionName,
      user.id,
      { force, metadata }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Transition impossible",
          details: result.errors,
          warnings: result.warnings,
          current_status: result.previousStatus,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      previous_status: result.previousStatus,
      new_status: result.newStatus,
      warnings: result.warnings,
      forced: force,
    });
  } catch (error: unknown) {
    console.error("[POST transitions] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
