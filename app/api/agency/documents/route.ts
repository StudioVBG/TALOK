export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agency/documents
 *
 * Liste les documents liés aux biens sous mandat de l'agence appelante.
 * Agrège : agency_mandates → property_ids + owner_ids → documents
 * (via property_id, lease_id ou owner_id).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface DocumentRow {
  id: string;
  title: string;
  type: string;
  ownerName: string;
  sizeBytes: number | null;
  createdAt: string;
  storagePath: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  bail: "Bail",
  EDL_entree: "EDL entrée",
  EDL_sortie: "EDL sortie",
  quittance: "Quittance",
  attestation_assurance: "Attestation assurance",
  attestation_loyer: "Attestation loyer",
  justificatif_revenus: "Justificatif revenus",
  piece_identite: "Pièce d'identité",
  mandat: "Mandat",
  facture: "Facture",
  autre: "Autre",
};

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
    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { data: mandates } = await (supabase as any)
      .from("agency_mandates")
      .select(
        "id, property_ids, owner_profile_id, owner:profiles!agency_mandates_owner_profile_id_fkey(prenom, nom)",
      )
      .eq("agency_profile_id", profile.id);

    const propertyIds = new Set<string>();
    const ownerIds = new Set<string>();
    const ownerNameById = new Map<string, string>();
    for (const m of (mandates ?? []) as Array<{
      property_ids: string[] | null;
      owner_profile_id: string | null;
      owner: { prenom: string | null; nom: string | null } | null;
    }>) {
      if (m.owner_profile_id) {
        ownerIds.add(m.owner_profile_id);
        const ownerName = m.owner
          ? `${m.owner.prenom ?? ""} ${m.owner.nom ?? ""}`.trim() || "Propriétaire"
          : "Propriétaire";
        ownerNameById.set(m.owner_profile_id, ownerName);
      }
      for (const pid of m.property_ids ?? []) propertyIds.add(pid);
    }

    if (propertyIds.size === 0 && ownerIds.size === 0) {
      return NextResponse.json({ documents: [], stats: defaultStats() });
    }

    const propIds = Array.from(propertyIds);
    const ownIds = Array.from(ownerIds);

    let leaseIds: string[] = [];
    if (propIds.length > 0) {
      const { data: leases } = await supabase
        .from("leases")
        .select("id")
        .in("property_id", propIds);
      leaseIds = (leases ?? []).map((l: { id: string }) => l.id);
    }

    const orFilters: string[] = [];
    if (propIds.length > 0) orFilters.push(`property_id.in.(${propIds.join(",")})`);
    if (leaseIds.length > 0) orFilters.push(`lease_id.in.(${leaseIds.join(",")})`);
    if (ownIds.length > 0) orFilters.push(`owner_id.in.(${ownIds.join(",")})`);

    if (orFilters.length === 0) {
      return NextResponse.json({ documents: [], stats: defaultStats() });
    }

    const { data: docs, error: docsError } = await supabase
      .from("documents")
      .select(
        "id, type, title, original_filename, storage_path, owner_id, property_id, lease_id, metadata, created_at",
      )
      .or(orFilters.join(","))
      .order("created_at", { ascending: false })
      .limit(200);

    if (docsError) {
      return NextResponse.json(
        { error: docsError.message ?? "Erreur lecture documents" },
        { status: 500 },
      );
    }

    const documents: DocumentRow[] = ((docs ?? []) as Array<{
      id: string;
      type: string;
      title: string | null;
      original_filename: string | null;
      storage_path: string | null;
      owner_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>).map((d) => {
      const sizeBytes =
        d.metadata && typeof d.metadata === "object" && "size" in d.metadata
          ? Number((d.metadata as { size?: unknown }).size) || null
          : null;
      const ownerName =
        d.owner_id && ownerNameById.has(d.owner_id)
          ? ownerNameById.get(d.owner_id)!
          : "Tous";
      const title =
        d.title?.trim() ||
        d.original_filename?.trim() ||
        `Document ${d.type}`;
      return {
        id: d.id,
        title,
        type: d.type,
        ownerName,
        sizeBytes,
        createdAt: d.created_at,
        storagePath: d.storage_path,
      };
    });

    const stats: Record<string, number> = {};
    for (const d of documents) {
      stats[d.type] = (stats[d.type] ?? 0) + 1;
    }

    return NextResponse.json({
      documents,
      stats: {
        total: documents.length,
        byType: stats,
        knownTypes: TYPE_LABELS,
      },
    });
  } catch (error) {
    console.error("[api/agency/documents] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}

function defaultStats() {
  return { total: 0, byType: {} as Record<string, number>, knownTypes: TYPE_LABELS };
}
