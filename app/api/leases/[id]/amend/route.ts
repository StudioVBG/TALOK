export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { canTransitionTo } from "@/lib/services/lease-cancellation";

/**
 * POST /api/leases/[id]/amend — Create a lease amendment (avenant)
 *
 * Creates an amendment record and transitions the lease to "amended" status.
 * Only the property owner can create amendments, and only for active leases.
 *
 * Body: {
 *   amendment_type: string,
 *   description: string,
 *   effective_date: string (YYYY-MM-DD),
 *   old_values?: Record<string, unknown>,
 *   new_values?: Record<string, unknown>,
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const {
      amendment_type,
      description,
      effective_date,
      old_values = {},
      new_values = {},
    } = body;

    // Validate required fields
    if (!amendment_type || !description || !effective_date) {
      return NextResponse.json(
        { error: "Les champs amendment_type, description et effective_date sont obligatoires" },
        { status: 400 }
      );
    }

    const validTypes = [
      "loyer_revision",
      "ajout_colocataire",
      "retrait_colocataire",
      "changement_charges",
      "travaux",
      "autre",
    ];
    if (!validTypes.includes(amendment_type)) {
      return NextResponse.json(
        { error: `Type d'avenant invalide. Types autorisés : ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch lease with property for ownership check
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        loyer,
        charges_forfaitaires,
        property_id,
        properties!leases_property_id_fkey (
          id,
          owner_id,
          adresse_complete
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // Check ownership
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const property = (lease as any).properties;
    const isOwner = property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut créer un avenant" },
        { status: 403 }
      );
    }

    // Verify lease status allows amendment
    const currentStatus = lease.statut as string;
    if (currentStatus !== "active" && currentStatus !== "amended") {
      return NextResponse.json(
        {
          error: "Seul un bail actif peut faire l'objet d'un avenant",
          current_status: currentStatus,
        },
        { status: 400 }
      );
    }

    // Verify state machine transition (only if going from active → amended)
    if (currentStatus === "active" && !canTransitionTo(currentStatus as any, "amended")) {
      return NextResponse.json(
        { error: "Transition de statut non autorisée" },
        { status: 400 }
      );
    }

    // Create the amendment
    const { data: amendment, error: amendError } = await serviceClient
      .from("lease_amendments")
      .insert({
        lease_id: leaseId,
        amendment_type,
        description,
        effective_date,
        old_values,
        new_values,
        created_by: user.id,
      })
      .select()
      .single();

    if (amendError) {
      // If table doesn't exist yet
      if (amendError.code === "42P01") {
        return NextResponse.json(
          { error: "La table des avenants n'est pas encore disponible. Migration requise." },
          { status: 503 }
        );
      }
      throw amendError;
    }

    // Transition lease to "amended" status if currently active
    if (currentStatus === "active") {
      await serviceClient
        .from("leases")
        .update({
          statut: "amended",
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaseId);
    }

    // Emit outbox event
    await serviceClient.from("outbox").insert({
      event_type: "Lease.Amended",
      payload: {
        lease_id: leaseId,
        amendment_id: amendment?.id,
        amendment_type,
        effective_date,
        created_by: profile.id,
        property_address: property?.adresse_complete || null,
      },
    });

    // Audit log
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "lease_amendment_created",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        amendment_id: amendment?.id,
        amendment_type,
        effective_date,
        old_values,
        new_values,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Avenant créé avec succès",
      amendment,
    });
  } catch (error: unknown) {
    console.error("[amend] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leases/[id]/amend — List amendments for a lease
 */
export async function GET(
  request: Request,
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

    // Verify the lease exists and user has access
    const { data: lease } = await serviceClient
      .from("leases")
      .select("id, statut")
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // Fetch amendments
    const { data: amendments, error: fetchError } = await serviceClient
      .from("lease_amendments")
      .select("*")
      .eq("lease_id", leaseId)
      .order("effective_date", { ascending: false });

    if (fetchError) {
      if (fetchError.code === "42P01") {
        return NextResponse.json({ amendments: [] });
      }
      throw fetchError;
    }

    return NextResponse.json({ amendments: amendments || [] });
  } catch (error: unknown) {
    console.error("[amend] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
