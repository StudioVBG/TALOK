export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/suppliers
 * GET  — liste les fournisseurs du syndic connecté
 * POST — crée un fournisseur
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSyndic } from "@/lib/helpers/syndic-auth";

const SUPPLIER_CATEGORIES = [
  "entretien",
  "ascenseur",
  "chauffage",
  "plomberie",
  "electricite",
  "espaces_verts",
  "nettoyage",
  "gardiennage",
  "securite",
  "assurance",
  "expert_comptable",
  "avocat",
  "architecte",
  "travaux_batiment",
  "autre",
] as const;

const SupplierSchema = z.object({
  name: z.string().min(1).max(255),
  legal_form: z.string().max(50).nullable().optional(),
  siret: z.string().regex(/^\d{14}$/).nullable().optional(),
  vat_number: z.string().max(30).nullable().optional(),
  category: z.enum(SUPPLIER_CATEGORIES).default("autre"),
  contact_name: z.string().max(255).nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().max(30).nullable().optional(),
  address_line1: z.string().max(500).nullable().optional(),
  postal_code: z.string().max(10).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().length(2).default("FR"),
  notes: z.string().max(2000).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "active";
    const category = searchParams.get("category");

    let query = auth.serviceClient
      .from("copro_suppliers")
      .select("*")
      .eq("status", status)
      .order("name", { ascending: true });

    if (!auth.isAdmin) {
      query = query.eq("syndic_profile_id", auth.profile.id);
    }
    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const parse = SupplierSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { data, error } = await auth.serviceClient
      .from("copro_suppliers")
      .insert({
        ...parse.data,
        syndic_profile_id: auth.profile.id,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
