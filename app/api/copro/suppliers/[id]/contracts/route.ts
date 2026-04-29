export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSyndic } from "@/lib/helpers/syndic-auth";

const ContractSchema = z.object({
  site_id: z.string().uuid(),
  contract_number: z.string().max(100).nullable().optional(),
  title: z.string().min(1).max(255),
  category: z
    .enum([
      "entretien",
      "ascenseur",
      "chauffage",
      "plomberie",
      "electricite",
      "espaces_verts",
      "nettoyage",
      "gardiennage",
      "securite",
      "assurance_immeuble",
      "expert_comptable",
      "avocat",
      "autre",
    ])
    .default("entretien"),
  start_date: z.string(),
  end_date: z.string().nullable().optional(),
  duration_months: z.number().int().min(1).max(120).nullable().optional(),
  tacit_renewal: z.boolean().default(false),
  notice_period_months: z.number().int().min(0).max(12).default(3),
  payment_frequency: z.enum(["monthly", "quarterly", "annual", "on_demand"]).default("monthly"),
  amount_cents: z.number().int().nonnegative().nullable().optional(),
  vat_rate_pct: z.number().min(0).max(100).nullable().optional(),
  contract_pdf_url: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: supplierId } = await params;
  try {
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const { data, error } = await auth.serviceClient
      .from("copro_supplier_contracts")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("start_date", { ascending: false });

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: supplierId } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const parse = ContractSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const auth = await requireSyndic(request, { siteId: parse.data.site_id });
    if (auth instanceof NextResponse) return auth;

    const { data, error } = await auth.serviceClient
      .from("copro_supplier_contracts")
      .insert({
        supplier_id: supplierId,
        ...parse.data,
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
