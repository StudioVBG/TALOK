/**
 * Auto-mapping des building_units (côté owner) vers les copro_lots
 * (côté syndic). Cherche une correspondance par :
 *   1. unique_code de la property du lot ↔ lot_number
 *   2. couple floor-position ↔ lot_number ("3-2" ou "3.2")
 *
 * Utilisé par :
 *   - POST /api/buildings/[id]/auto-map-copro-lots (manuel)
 *   - POST /api/syndic/site-claims/[claimId] (automatique après approve)
 *
 * Ne touche pas les unités déjà mappées et ne réutilise pas un copro_lot
 * déjà attaché à une autre unité.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AutoMapResult {
  mapped: number;
  total_units: number;
  total_lots_available: number;
  unmapped: number;
  skipped_reason?: string;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

export async function autoMapCoproLots(
  serviceClient: SupabaseClient,
  buildingId: string
): Promise<AutoMapResult> {
  const { data: building } = await serviceClient
    .from("buildings")
    .select("id, site_id, site_link_status")
    .eq("id", buildingId)
    .maybeSingle();

  if (!building) {
    return {
      mapped: 0,
      total_units: 0,
      total_lots_available: 0,
      unmapped: 0,
      skipped_reason: "building_not_found",
    };
  }

  const b = building as { site_id: string | null; site_link_status: string };
  if (!b.site_id || b.site_link_status !== "linked") {
    return {
      mapped: 0,
      total_units: 0,
      total_lots_available: 0,
      unmapped: 0,
      skipped_reason: "not_linked",
    };
  }

  const { data: site } = await serviceClient
    .from("sites")
    .select("copro_entity_id")
    .eq("id", b.site_id)
    .maybeSingle();
  const coproEntityId = (site as { copro_entity_id: string | null } | null)?.copro_entity_id;
  if (!coproEntityId) {
    return {
      mapped: 0,
      total_units: 0,
      total_lots_available: 0,
      unmapped: 0,
      skipped_reason: "no_copro_entity",
    };
  }

  const { data: units } = await serviceClient
    .from("building_units")
    .select(
      "id, floor, position, copro_lot_id, property_id, properties:properties(unique_code)"
    )
    .eq("building_id", buildingId)
    .is("copro_lot_id", null);
  const targetUnits = (units ?? []) as Array<{
    id: string;
    floor: number;
    position: number;
    properties: { unique_code: string | null } | null;
  }>;

  if (targetUnits.length === 0) {
    return {
      mapped: 0,
      total_units: 0,
      total_lots_available: 0,
      unmapped: 0,
      skipped_reason: "no_units_to_map",
    };
  }

  const { data: lots } = await serviceClient
    .from("copro_lots")
    .select("id, lot_number")
    .eq("copro_entity_id", coproEntityId)
    .eq("is_active", true);
  const targetLots = (lots ?? []) as Array<{ id: string; lot_number: string }>;

  const { data: alreadyMapped } = await serviceClient
    .from("building_units")
    .select("copro_lot_id")
    .not("copro_lot_id", "is", null);
  const usedLotIds = new Set(
    (alreadyMapped ?? []).map((m) => (m as { copro_lot_id: string }).copro_lot_id)
  );
  const availableLots = targetLots.filter((l) => !usedLotIds.has(l.id));

  let mappedCount = 0;
  for (const unit of targetUnits) {
    const candidates: string[] = [];
    if (unit.properties?.unique_code) {
      candidates.push(normalize(unit.properties.unique_code));
    }
    candidates.push(`${unit.floor}-${unit.position}`);
    candidates.push(`${unit.floor}.${unit.position}`);

    const match = availableLots.find((lot) =>
      candidates.includes(normalize(lot.lot_number))
    );
    if (!match) continue;

    const { error } = await serviceClient
      .from("building_units")
      .update({ copro_lot_id: match.id, updated_at: new Date().toISOString() })
      .eq("id", unit.id);
    if (!error) {
      mappedCount += 1;
      const idx = availableLots.findIndex((l) => l.id === match.id);
      if (idx >= 0) availableLots.splice(idx, 1);
    }
  }

  return {
    mapped: mappedCount,
    total_units: targetUnits.length,
    total_lots_available: targetLots.length,
    unmapped: targetUnits.length - mappedCount,
  };
}
