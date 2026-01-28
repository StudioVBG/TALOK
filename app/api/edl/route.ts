export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/middleware/rate-limit";

/**
 * GET /api/edl - Liste tous les EDL accessibles par l'utilisateur
 *
 * Query params:
 *   - type: "entree" | "sortie" (optionnel)
 *   - status: "draft" | "scheduled" | "in_progress" | "completed" | "signed" (optionnel)
 *   - property_id: UUID (optionnel, filtre par propriété)
 *   - lease_id: UUID (optionnel, filtre par bail)
 *   - limit: number (optionnel, défaut 50)
 *   - offset: number (optionnel, défaut 0)
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
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const propertyId = searchParams.get("property_id");
    const leaseId = searchParams.get("lease_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Récupérer le profil pour déterminer le rôle
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Construire la requête de base
    let query = supabase
      .from("edl")
      .select(
        `
        *,
        lease:leases(
          id,
          property_id,
          type_bail,
          date_debut,
          date_fin,
          statut,
          property:properties(
            id,
            adresse_complete,
            ville,
            code_postal,
            type,
            owner_id
          )
        ),
        edl_signatures(
          id,
          signer_role,
          signed_at,
          signer_profile_id
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtres optionnels
    if (type === "entree" || type === "sortie") {
      query = query.eq("type", type);
    }
    if (
      status &&
      [
        "draft",
        "scheduled",
        "in_progress",
        "completed",
        "signed",
        "disputed",
        "closed",
      ].includes(status)
    ) {
      query = query.eq("status", status);
    }
    if (leaseId) {
      query = query.eq("lease_id", leaseId);
    }
    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    const { data: edls, error, count } = await query;

    if (error) {
      console.error("[GET /api/edl] Error:", error);
      return NextResponse.json(
        { error: error.message || "Erreur lors de la récupération des EDL" },
        { status: 500 }
      );
    }

    // Filtrer par accès en fonction du rôle
    // Pour les propriétaires: seuls les EDL de leurs propriétés
    // Pour les locataires: seuls les EDL de leurs baux
    // Pour les admins: tous les EDL
    let filteredEdls = edls || [];

    if (profile.role !== "admin") {
      filteredEdls = filteredEdls.filter((edl: any) => {
        // Créateur
        if (edl.created_by === user.id) return true;

        // Propriétaire du bien
        const lease = Array.isArray(edl.lease) ? edl.lease[0] : edl.lease;
        if (lease?.property?.owner_id === profile.id) return true;

        // Signataire de l'EDL
        const isSignatory = edl.edl_signatures?.some(
          (s: any) => s.signer_profile_id === profile.id
        );
        if (isSignatory) return true;

        return false;
      });
    }

    return NextResponse.json({
      edls: filteredEdls,
      total: count || filteredEdls.length,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error("[GET /api/edl] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/edl - Créer un nouvel EDL (standalone, sans passer par /api/properties)
 *
 * Body:
 *   - lease_id: UUID (requis)
 *   - type: "entree" | "sortie" (requis)
 *   - scheduled_at?: string (ISO date)
 *   - general_notes?: string
 *   - keys?: Array<{ type: string, quantite: number, notes?: string }>
 */
export async function POST(request: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = applyRateLimit(request, "edl");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { lease_id, type, scheduled_at, general_notes, keys } = body;

    // Validation
    if (!lease_id) {
      return NextResponse.json(
        { error: "Le bail (lease_id) est requis" },
        { status: 400 }
      );
    }

    if (!type || !["entree", "sortie"].includes(type)) {
      return NextResponse.json(
        { error: "Type d'EDL invalide (entree ou sortie requis)" },
        { status: 400 }
      );
    }

    // Vérifier les permissions (propriétaire ou admin)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(
        `
        id,
        property_id,
        property:properties!inner(id, owner_id)
      `
      )
      .eq("id", lease_id)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const leaseData = lease as any;
    const isOwner = leaseData.property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut créer un EDL" },
        { status: 403 }
      );
    }

    // Vérifier qu'il n'existe pas déjà un EDL du même type non terminé
    const { data: existingEdl } = await supabase
      .from("edl")
      .select("id, status")
      .eq("lease_id", lease_id)
      .eq("type", type)
      .in("status", ["draft", "scheduled", "in_progress"])
      .maybeSingle();

    if (existingEdl) {
      return NextResponse.json(
        {
          error: `Un EDL ${type === "entree" ? "d'entrée" : "de sortie"} est déjà en cours`,
          existing_edl_id: existingEdl.id,
        },
        { status: 409 }
      );
    }

    // Créer l'EDL
    const scheduledDate = scheduled_at
      ? new Date(scheduled_at).toISOString().split("T")[0]
      : null;

    const { data: newEdl, error: createError } = await supabase
      .from("edl")
      .insert({
        lease_id,
        property_id: leaseData.property_id,
        type,
        status: scheduled_at ? "scheduled" : "draft",
        scheduled_at: scheduled_at || null,
        scheduled_date: scheduledDate,
        general_notes: general_notes || null,
        keys: keys || [],
        created_by: user.id,
      } as any)
      .select()
      .single();

    if (createError) {
      console.error("[POST /api/edl] DB Error:", createError);
      return NextResponse.json(
        { error: createError.message || "Erreur lors de la création de l'EDL" },
        { status: 500 }
      );
    }

    // Injecter automatiquement les signataires du bail
    const { data: leaseSigners } = await supabase
      .from("lease_signers")
      .select("profile_id, role")
      .eq("lease_id", lease_id);

    if (leaseSigners && leaseSigners.length > 0) {
      const edlSignatures = leaseSigners.map((ls: any) => ({
        edl_id: (newEdl as any).id,
        signer_user: null,
        signer_profile_id: ls.profile_id,
        signer_role:
          ls.role === "proprietaire" || ls.role === "owner"
            ? "owner"
            : "tenant",
        invitation_token: crypto.randomUUID(),
      }));

      await supabase.from("edl_signatures").insert(edlSignatures);
    }

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "edl_created",
      entity_type: "edl",
      entity_id: (newEdl as any).id,
      metadata: { type, lease_id },
    } as any);

    return NextResponse.json({ edl: newEdl }, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/edl] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
