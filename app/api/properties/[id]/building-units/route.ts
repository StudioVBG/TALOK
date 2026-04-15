export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { z } from "zod";

/**
 * Payload d'un lot envoyé par le wizard / UnitsManagement.
 * `meuble` est explicite (Phase 2 — fin du hardcode type-based).
 */
const buildingUnitPayloadSchema = z.object({
  id: z.string().optional(),
  floor: z.number().int().min(-5).max(50),
  position: z.string().min(1).max(20),
  type: z.enum(["appartement", "studio", "local_commercial", "parking", "cave", "bureau"]),
  surface: z.number().positive(),
  nb_pieces: z.number().int().min(0),
  template: z.string().optional().nullable(),
  loyer_hc: z.number().min(0),
  charges: z.number().min(0),
  depot_garantie: z.number().min(0),
  status: z.enum(["vacant", "occupe", "travaux", "reserve"]).optional(),
  meuble: z.boolean().optional(),
});

/**
 * Champs immeuble acceptés. Tous optionnels pour préserver la compat
 * avec les appels legacy du wizard pré-Phase 3.
 */
const bodySchema = z.object({
  // Identité
  name: z.string().trim().min(1).max(200).optional(),

  // Plan
  building_floors: z.number().int().min(1).max(50).optional(),
  construction_year: z.number().int().min(1800).max(2100).optional(),
  surface_totale: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),

  // Équipements communs
  has_ascenseur: z.boolean().optional(),
  has_gardien: z.boolean().optional(),
  has_interphone: z.boolean().optional(),
  has_digicode: z.boolean().optional(),
  has_local_velo: z.boolean().optional(),
  has_local_poubelles: z.boolean().optional(),
  has_parking_commun: z.boolean().optional(),
  has_jardin_commun: z.boolean().optional(),

  // Mode de possession
  ownership_type: z.enum(["full", "partial"]).optional(),
  total_lots_in_building: z.number().int().positive().optional(),

  // Lots
  units: z.array(buildingUnitPayloadSchema).min(1, "Au moins un lot requis"),
});

type BlockingUnit = {
  unit_id: string;
  floor: number;
  position: string;
  lease_id: string | null;
  lease_statut: string | null;
};

/**
 * POST /api/properties/[id]/building-units
 *
 * Upsert atomique d'un immeuble et de ses lots pour une property de type immeuble.
 * Toute la logique de DB (UPSERT building + DELETE/INSERT units + UPSERT lots)
 * est encapsulée dans la RPC `upsert_building_with_units` (transaction SQL).
 *
 * Garde : refuse si au moins un lot a un bail bloquant (active / pending_signature
 * / fully_signed / notice_given).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let rawBody: unknown;
  try {
    const rateLimitResponse = applyRateLimit(request, "property");
    if (rateLimitResponse) return rateLimitResponse;

    const { id: propertyId } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError?.message ?? "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // ─── Auth : profile owner ou admin ────────────────────────────────────
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // ─── Property parent existe et appartient au user ────────────────────
    const { data: property, error: propErr } = await serviceClient
      .from("properties")
      .select("id, owner_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (propErr || !property) {
      return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
    }
    if (property.owner_id !== profile.id && profile.role !== "admin") {
      return NextResponse.json({ error: "Vous n'êtes pas propriétaire de ce bien" }, { status: 403 });
    }

    // ─── Validation Zod ──────────────────────────────────────────────────
    const body = await request.json();
    rawBody = body;
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Cohérence ownership_type ↔ total_lots_in_building
    if (
      parsed.data.ownership_type === "partial" &&
      parsed.data.total_lots_in_building == null
    ) {
      return NextResponse.json(
        {
          error:
            "Copropriété partielle : indiquez le nombre total de lots de l'immeuble physique.",
        },
        { status: 400 }
      );
    }

    const { units, ...buildingData } = parsed.data;

    // ─── Garde pré-remplacement : aucun lot n'a un bail bloquant ─────────
    // On vérifie AVANT d'appeler la RPC pour pouvoir renvoyer un 409 lisible.
    // La RPC refait la même vérification transactionnellement (ERRCODE P0002).
    const { data: existingBuilding } = await serviceClient
      .from("buildings")
      .select("id")
      .eq("property_id", propertyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingBuilding?.id) {
      const { data: blocking, error: blockingErr } = await serviceClient.rpc(
        "building_active_lease_units",
        { p_building_id: existingBuilding.id }
      );
      if (blockingErr) {
        console.error("[building-units] building_active_lease_units error:", blockingErr);
        return NextResponse.json({ error: "Erreur de vérification des baux" }, { status: 500 });
      }
      const blockingList = (blocking ?? []) as BlockingUnit[];
      if (blockingList.length > 0) {
        return NextResponse.json(
          {
            error:
              "Impossible de modifier les lots : " +
              blockingList.length +
              " lot(s) ont un bail actif. Résilier les baux d'abord.",
            blocking_units: blockingList.map((b) => ({
              floor: b.floor,
              position: b.position,
              lease_id: b.lease_id,
              lease_statut: b.lease_statut,
            })),
          },
          { status: 409 }
        );
      }
    }

    // ─── Appel RPC transactionnelle ──────────────────────────────────────
    const { data: rpcData, error: rpcErr } = await serviceClient.rpc(
      "upsert_building_with_units",
      {
        p_property_id: propertyId,
        p_building_data: buildingData,
        p_units: units,
      }
    );

    if (rpcErr) {
      // ERRCODE P0002 : garde baux actifs (fallback si la pré-vérif ci-dessus a raté)
      if (
        typeof rpcErr.message === "string" &&
        rpcErr.message.includes("active_leases_blocking")
      ) {
        return NextResponse.json(
          {
            error:
              "Impossible de modifier les lots : certains lots ont un bail actif. Résilier les baux d'abord.",
            detail: rpcErr.message,
          },
          { status: 409 }
        );
      }
      // ERRCODE P0001 : property introuvable
      if (
        typeof rpcErr.message === "string" &&
        rpcErr.message.includes("property_not_found")
      ) {
        return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
      }
      console.error("[building-units] RPC error:", rpcErr);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de l'immeuble", detail: rpcErr.message },
        { status: 500 }
      );
    }

    const result = rpcData as {
      building_id: string;
      unit_count: number;
      lot_property_ids: string[];
    };

    return NextResponse.json({
      success: true,
      building_id: result.building_id,
      count: result.unit_count,
      lot_property_ids: result.lot_property_ids,
    });
  } catch (e) {
    const errObj = e instanceof Error ? { message: e.message, stack: e.stack, name: e.name } : e;
    console.error("[building-units] Full error:", JSON.stringify(errObj, null, 2));
    console.error("[building-units] Payload received:", JSON.stringify(rawBody, null, 2));
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
