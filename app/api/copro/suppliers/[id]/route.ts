export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSyndic } from "@/lib/helpers/syndic-auth";

const PatchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().optional(),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  address_line1: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const { data, error } = await auth.serviceClient
      .from("copro_suppliers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
    }
    if (!auth.isAdmin && (data as { syndic_profile_id: string }).syndic_profile_id !== auth.profile.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const parse = PatchSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { data: current } = await auth.serviceClient
      .from("copro_suppliers")
      .select("syndic_profile_id")
      .eq("id", id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
    }
    if (!auth.isAdmin && (current as { syndic_profile_id: string }).syndic_profile_id !== auth.profile.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { data, error } = await auth.serviceClient
      .from("copro_suppliers")
      .update({ ...parse.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const { data: current } = await auth.serviceClient
      .from("copro_suppliers")
      .select("syndic_profile_id")
      .eq("id", id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
    }
    if (!auth.isAdmin && (current as { syndic_profile_id: string }).syndic_profile_id !== auth.profile.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Soft archive plutôt que delete pour préserver l'historique des contrats
    const { error } = await auth.serviceClient
      .from("copro_suppliers")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
