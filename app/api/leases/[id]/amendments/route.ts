export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { z } from "zod";

const createAmendmentSchema = z.object({
  amendment_type: z.enum([
    "loyer", "charges", "duree", "occupant_ajout", "occupant_retrait",
    "clause_ajout", "clause_modification", "clause_suppression",
    "depot_garantie", "usage", "travaux", "autre",
  ]),
  description: z.string().min(10, "Description trop courte (min 10 caractères)"),
  motif: z.string().optional(),
  old_values: z.record(z.unknown()).default({}),
  new_values: z.record(z.unknown()),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD requis"),
  notes: z.string().optional(),
});

/**
 * GET /api/leases/[id]/amendments
 * Liste tous les avenants d'un bail
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

    const { data: amendments, error } = await supabase
      .from("lease_amendments")
      .select("*")
      .eq("lease_id", leaseId)
      .order("amendment_number", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ amendments: amendments || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leases/[id]/amendments
 * Crée un nouvel avenant pour un bail actif
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

    // Vérifier profil propriétaire
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Seul le propriétaire peut créer un avenant" }, { status: 403 });
    }

    const serviceClient = getServiceClient();

    // Vérifier le bail
    const { data: lease } = await serviceClient
      .from("leases")
      .select("id, statut, loyer, charges_forfaitaires, depot_de_garantie, date_fin, property_id, properties!leases_property_id_fkey(owner_id)")
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    if ((lease as any).properties?.owner_id !== profile.id) {
      return NextResponse.json({ error: "Ce bail ne vous appartient pas" }, { status: 403 });
    }

    if (!["active", "notice_given"].includes(lease.statut)) {
      return NextResponse.json({
        error: "Un avenant ne peut être créé que sur un bail actif ou en préavis",
        current_status: lease.statut,
      }, { status: 400 });
    }

    // Valider les données
    const body = await request.json();
    const validated = createAmendmentSchema.parse(body);

    // Auto-remplir old_values si le type est connu
    let oldValues = validated.old_values;
    if (Object.keys(oldValues).length === 0) {
      switch (validated.amendment_type) {
        case "loyer":
          oldValues = { loyer: lease.loyer };
          break;
        case "charges":
          oldValues = { charges_forfaitaires: lease.charges_forfaitaires };
          break;
        case "depot_garantie":
          oldValues = { depot_de_garantie: lease.depot_de_garantie };
          break;
        case "duree":
          oldValues = { date_fin: lease.date_fin };
          break;
      }
    }

    // Créer l'avenant
    const { data: amendment, error: insertError } = await serviceClient
      .from("lease_amendments")
      .insert({
        lease_id: leaseId,
        amendment_type: validated.amendment_type,
        description: validated.description,
        motif: validated.motif || null,
        old_values: oldValues,
        new_values: validated.new_values,
        effective_date: validated.effective_date,
        notes: validated.notes || null,
        created_by: user.id,
        status: "draft",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Audit
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "amendment_created",
      entity_type: "lease_amendment",
      entity_id: amendment.id,
      metadata: {
        lease_id: leaseId,
        amendment_type: validated.amendment_type,
        amendment_number: amendment.amendment_number,
      },
    } as any);

    return NextResponse.json({ amendment }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
