export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour la régularisation des charges
 * GET /api/leases/[id]/regularization - Calculer la régularisation
 * POST /api/leases/[id]/regularization - Créer une régularisation
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { z } from "zod";

const createRegularizationSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  provisions_paid: z.number().min(0).optional(),
  actual_charges: z.number().min(0).optional(),
  charge_details: z.array(z.object({
    category: z.string(),
    description: z.string(),
    budgeted: z.number(),
    actual: z.number(),
    refacturable: z.boolean().default(true),
  })).optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leaseId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const periodStart = searchParams.get("period_start") || getDefaultPeriodStart();
    const periodEnd = searchParams.get("period_end") || getDefaultPeriodEnd();

    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Calculer la régularisation
    const { data, error } = await supabase.rpc("calculate_charge_regularization", {
      p_lease_id: leaseId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });

    if (error) {
      console.error("Erreur calcul régularisation:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Erreur API regularization GET:", error);
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
  try {
    const { id: leaseId } = await params;
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier que l'utilisateur est propriétaire du bail
    const { data: lease } = await supabase
      .from("leases")
      .select("id, property:properties(owner_id)")
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const isOwner = (lease.property as any)?.owner_id === profile.id;
    if (!isOwner && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut créer une régularisation" },
        { status: 403 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validatedData = createRegularizationSchema.parse(body);

    // Calculer la régularisation si pas de valeurs fournies
    let calculationData;
    if (!validatedData.provisions_paid || !validatedData.actual_charges) {
      const { data: calcResult, error: calcError } = await supabase.rpc(
        "calculate_charge_regularization",
        {
          p_lease_id: leaseId,
          p_period_start: validatedData.period_start,
          p_period_end: validatedData.period_end,
        }
      );

      if (calcError) {
        return NextResponse.json({ error: calcError.message }, { status: 500 });
      }

      calculationData = calcResult;
    }

    // Créer la régularisation
    const serviceClient = createServiceRoleClient();
    const { data: regularization, error: createError } = await serviceClient
      .from("charge_regularizations")
      .insert({
        lease_id: leaseId,
        period_start: validatedData.period_start,
        period_end: validatedData.period_end,
        provisions_paid: validatedData.provisions_paid ?? calculationData?.provisions_paid ?? 0,
        actual_charges: validatedData.actual_charges ?? calculationData?.actual_charges ?? 0,
        charge_details: validatedData.charge_details ?? calculationData?.details ?? [],
        notes: validatedData.notes,
        status: "draft",
        created_by: profile.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création régularisation:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json(regularization, { status: 201 });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API regularization POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

function getDefaultPeriodStart(): string {
  const now = new Date();
  const lastYear = new Date(now.getFullYear() - 1, 0, 1);
  return lastYear.toISOString().split("T")[0];
}

function getDefaultPeriodEnd(): string {
  const now = new Date();
  const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
  return endOfLastYear.toISOString().split("T")[0];
}







