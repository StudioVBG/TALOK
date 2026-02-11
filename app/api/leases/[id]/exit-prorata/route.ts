export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { calculateExitProrata, generateFinalInvoice } from "@/lib/services/exit-prorata.service";
import { z } from "zod";

/**
 * GET /api/leases/[id]/exit-prorata?exit_date=2026-03-15
 * Simule le calcul du prorata sans créer de facture
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

    const { searchParams } = new URL(request.url);
    const exitDate = searchParams.get("exit_date");

    if (!exitDate || !/^\d{4}-\d{2}-\d{2}$/.test(exitDate)) {
      return NextResponse.json(
        { error: "Paramètre exit_date requis au format YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();
    const { data: lease } = await serviceClient
      .from("leases")
      .select("id, loyer, charges_forfaitaires, charges_type")
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const prorata = calculateExitProrata({
      leaseId,
      exitDate,
      monthlyRent: lease.loyer || 0,
      monthlyCharges: lease.charges_forfaitaires || 0,
      chargesType: (lease.charges_type as "forfait" | "provisions") || "forfait",
    });

    return NextResponse.json({
      simulation: true,
      prorata,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leases/[id]/exit-prorata
 * Génère la facture finale proratisée
 *
 * Body: { exit_date: "YYYY-MM-DD" }
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const schema = z.object({
      exit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD requis"),
    });
    const { exit_date } = schema.parse(body);

    const serviceClient = getServiceClient();
    const result = await generateFinalInvoice(serviceClient, leaseId, exit_date, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error, prorata: result.prorata }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      invoice_id: result.invoice_id,
      prorata: result.prorata,
    });
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
