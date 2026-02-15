export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { createEDL } from "@/lib/services/edl-creation.service";
import { z } from "zod";

/** Schéma Zod pour la création d'un EDL */
const createEdlSchema = z.object({
  lease_id: z.string().uuid("lease_id doit être un UUID valide"),
  type: z.enum(["entree", "sortie"], { required_error: "Le type est requis (entree ou sortie)" }),
  scheduled_at: z.string().datetime().optional().nullable(),
  general_notes: z.string().max(5000, "Notes trop longues (max 5000 caractères)").optional().nullable(),
  keys: z.array(z.object({
    type: z.string().min(1),
    quantite: z.number().int().min(0).max(100),
    notes: z.string().max(500).optional(),
  })).optional().nullable(),
});

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
      .maybeSingle();

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
      query = query.eq("status", status as any);
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
 * POST /api/edl - Create a new EDL (standalone, delegates to shared service)
 *
 * Body:
 *   - lease_id: UUID (required)
 *   - type: "entree" | "sortie" (required)
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();

    // Validation Zod
    const parsed = createEdlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", "),
        },
        { status: 400 }
      );
    }

    const { lease_id, type, scheduled_at, general_notes, keys } = parsed.data;

    const serviceClient = getServiceClient();

    // Resolve profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const result = await createEDL(serviceClient, {
      userId: user.id,
      profileId: (profile as Record<string, unknown>).id as string,
      profileRole: (profile as Record<string, unknown>).role as string,
      leaseId: lease_id,
      type,
      scheduledAt: scheduled_at ?? undefined,
      generalNotes: general_notes ?? undefined,
      keys: keys ?? undefined,
    });

    if (!result.success) {
      // Special case: existing EDL conflict should return 409 with the ID
      if (result.status === 409 || result.reused) {
        return NextResponse.json({ edl: result.edl });
      }
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ edl: result.edl }, { status: result.reused ? 200 : 201 });
  } catch (error: unknown) {
    console.error("[POST /api/edl] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
