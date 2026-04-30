export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/owner/copro
 *
 * Liste les copropriétés rattachées au propriétaire connecté via
 * `user_site_roles` (rôle `coproprietaire`, `coproprietaire_bailleur`,
 * `coproprietaire_nu`, `usufruitier`). Retourne pour chaque site les
 * lots possédés, les appels de fonds en attente, les AG à venir et les
 * documents distribués.
 *
 * Lecture seule. Aucune écriture, aucune migration : on consomme
 * uniquement l'existant via RLS. Si la RLS bloque, ajouter une policy
 * SELECT additionnelle sur sites/copro_units/copro_fund_calls/copro_assemblies
 * scopée par user_site_roles.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const COPRO_ROLE_CODES = [
  "coproprietaire",
  "coproprietaire_bailleur",
  "coproprietaire_nu",
  "usufruitier",
];

interface CoproSite {
  site: {
    id: string;
    name: string;
    address: string;
    syndic_name: string | null;
    syndic_email: string | null;
  };
  lots: Array<{
    id: string;
    number: string;
    tantiemes: number;
    tantiemes_total: number;
    surface_m2: number | null;
    type: string | null;
    floor: number | null;
    property_id: string | null;
    property_address: string | null;
  }>;
  fund_calls: Array<{
    id: string;
    period_label: string;
    amount_cents: number;
    paid_cents: number;
    status: "pending" | "partial" | "paid" | "overdue";
    due_date: string | null;
  }>;
  assemblies_upcoming: Array<{
    id: string;
    title: string;
    date: string | null;
    status: string;
  }>;
  balance_cents: number;
  documents: Array<{
    id: string;
    title: string;
    type: string;
    url: string | null;
    distributed_at: string;
  }>;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: roles } = await (supabase as any)
      .from("user_site_roles")
      .select("site_id, role_code")
      .eq("user_id", user.id)
      .in("role_code", COPRO_ROLE_CODES);

    const siteIds = Array.from(
      new Set(((roles ?? []) as Array<{ site_id: string }>).map((r) => r.site_id)),
    );

    if (siteIds.length === 0) {
      return NextResponse.json({ copros: [] });
    }

    const { data: sites } = await (supabase as any)
      .from("sites")
      .select(
        "id, name, address_line1, address_line2, postal_code, city, syndic_company_name, syndic_email, total_tantiemes_general",
      )
      .in("id", siteIds);

    const sitesById = new Map<string, any>();
    for (const s of (sites ?? []) as any[]) sitesById.set(s.id, s);

    const { data: lots } = await (supabase as any)
      .from("copro_units")
      .select(
        "id, site_id, lot_number, tantieme_general, type, floor, surface, property_id",
      )
      .in("site_id", siteIds)
      .eq("owner_profile_id", profile.id);

    const lotsBySite = new Map<string, any[]>();
    const propertyIds = new Set<string>();
    for (const lot of (lots ?? []) as Array<{
      site_id: string;
      property_id: string | null;
    }>) {
      const arr = lotsBySite.get(lot.site_id) ?? [];
      arr.push(lot);
      lotsBySite.set(lot.site_id, arr);
      if (lot.property_id) propertyIds.add(lot.property_id);
    }

    const propertyAddressById = new Map<string, string>();
    if (propertyIds.size > 0) {
      const { data: properties } = await supabase
        .from("properties")
        .select("id, adresse_complete")
        .in("id", Array.from(propertyIds));
      for (const p of (properties ?? []) as Array<{
        id: string;
        adresse_complete: string | null;
      }>) {
        propertyAddressById.set(p.id, p.adresse_complete ?? "");
      }
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: assemblies } = await (supabase as any)
      .from("copro_assemblies")
      .select("id, site_id, title, scheduled_at, status")
      .in("site_id", siteIds)
      .gte("scheduled_at", today)
      .order("scheduled_at", { ascending: true })
      .limit(20);

    const assembliesBySite = new Map<string, any[]>();
    for (const a of (assemblies ?? []) as Array<{ site_id: string }>) {
      const arr = assembliesBySite.get(a.site_id) ?? [];
      arr.push(a);
      assembliesBySite.set(a.site_id, arr);
    }

    const { data: fundCalls } = await (supabase as any)
      .from("copro_fund_calls")
      .select(
        "id, copro_lot_id, period_label, call_amount_cents, paid_amount_cents, payment_status, due_date, created_at",
      )
      .in(
        "copro_lot_id",
        ((lots ?? []) as Array<{ id: string }>).map((l) => l.id),
      )
      .order("due_date", { ascending: false })
      .limit(50);

    const fundCallsByLot = new Map<string, any[]>();
    for (const fc of (fundCalls ?? []) as Array<{ copro_lot_id: string }>) {
      const arr = fundCallsByLot.get(fc.copro_lot_id) ?? [];
      arr.push(fc);
      fundCallsByLot.set(fc.copro_lot_id, arr);
    }

    const { data: documents } = await supabase
      .from("documents")
      .select("id, title, original_filename, type, storage_path, created_at, metadata")
      .or(
        siteIds
          .map((sid) => `metadata->>site_id.eq.${sid}`)
          .join(","),
      )
      .order("created_at", { ascending: false })
      .limit(50);

    const docsBySite = new Map<string, any[]>();
    for (const doc of (documents ?? []) as Array<{
      metadata: Record<string, unknown> | null;
    }>) {
      const sid =
        doc.metadata && typeof doc.metadata === "object"
          ? (doc.metadata as { site_id?: string }).site_id
          : undefined;
      if (!sid) continue;
      const arr = docsBySite.get(sid) ?? [];
      arr.push(doc);
      docsBySite.set(sid, arr);
    }

    const copros: CoproSite[] = [];
    for (const sid of siteIds) {
      const site = sitesById.get(sid);
      if (!site) continue;

      const siteLots = lotsBySite.get(sid) ?? [];
      const siteFundCalls: CoproSite["fund_calls"] = [];
      let balanceCents = 0;

      for (const lot of siteLots) {
        const lotCalls = fundCallsByLot.get(lot.id) ?? [];
        for (const fc of lotCalls) {
          const amount = fc.call_amount_cents ?? 0;
          const paid = fc.paid_amount_cents ?? 0;
          balanceCents += amount - paid;
          siteFundCalls.push({
            id: fc.id,
            period_label: fc.period_label ?? "—",
            amount_cents: amount,
            paid_cents: paid,
            status: fc.payment_status,
            due_date: fc.due_date,
          });
        }
      }

      const address = [
        site.address_line1,
        site.address_line2,
        site.postal_code,
        site.city,
      ]
        .filter(Boolean)
        .join(", ");

      copros.push({
        site: {
          id: site.id,
          name: site.name,
          address,
          syndic_name: site.syndic_company_name,
          syndic_email: site.syndic_email,
        },
        lots: siteLots.map((l: any) => ({
          id: l.id,
          number: l.lot_number,
          tantiemes: l.tantieme_general ?? 0,
          tantiemes_total: site.total_tantiemes_general ?? 10000,
          surface_m2: l.surface ?? null,
          type: l.type,
          floor: l.floor,
          property_id: l.property_id,
          property_address: l.property_id
            ? propertyAddressById.get(l.property_id) ?? null
            : null,
        })),
        fund_calls: siteFundCalls,
        assemblies_upcoming: (assembliesBySite.get(sid) ?? []).map((a: any) => ({
          id: a.id,
          title: a.title ?? "Assemblée générale",
          date: a.scheduled_at,
          status: a.status ?? "scheduled",
        })),
        balance_cents: balanceCents,
        documents: (docsBySite.get(sid) ?? []).map((d: any) => ({
          id: d.id,
          title: (d.title?.trim() || d.original_filename || `Document ${d.type}`) as string,
          type: d.type,
          url: d.storage_path
            ? `/api/documents/file?path=${encodeURIComponent(d.storage_path)}&disposition=inline`
            : null,
          distributed_at: d.created_at,
        })),
      });
    }

    return NextResponse.json({ copros });
  } catch (error) {
    console.error("[api/owner/copro] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}
