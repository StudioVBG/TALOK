export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { withSecurity } from "@/lib/api/with-security";

/**
 * GET /api/deposits — List security deposits
 * Filterable by lease_id, status, with pagination
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const typedProfile = profile as { id: string; role: string };
    const url = new URL(request.url);
    const leaseId = url.searchParams.get("lease_id");
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = (page - 1) * limit;

    let query = serviceClient
      .from("security_deposits")
      .select(
        `
        *,
        lease:leases(
          id,
          type_bail,
          date_debut,
          date_fin,
          loyer,
          statut,
          property:properties(
            id,
            adresse_complete,
            owner_id,
            ville
          )
        ),
        tenant:profiles!security_deposits_tenant_id_fkey(
          id,
          prenom,
          nom,
          email
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // RBAC — PostgREST does not support passing a query builder to `.in()`
    // as a subquery, so we have to resolve the scope in two short hops.
    if (typedProfile.role === "owner") {
      const { data: ownedProperties } = await serviceClient
        .from("properties")
        .select("id")
        .eq("owner_id", typedProfile.id);

      const propertyIds = (ownedProperties || []).map((p: any) => p.id);
      if (propertyIds.length === 0) {
        return NextResponse.json({
          deposits: [],
          pagination: { page, limit, total: 0 },
        });
      }

      const { data: ownedLeases } = await serviceClient
        .from("leases")
        .select("id")
        .in("property_id", propertyIds);

      const leaseIds = (ownedLeases || []).map((l: any) => l.id);
      if (leaseIds.length === 0) {
        return NextResponse.json({
          deposits: [],
          pagination: { page, limit, total: 0 },
        });
      }

      query = query.in("lease_id", leaseIds);
    } else if (typedProfile.role === "tenant") {
      query = query.eq("tenant_id", typedProfile.id);
    } else if (typedProfile.role !== "admin") {
      return NextResponse.json({ deposits: [], pagination: { page: 1, limit, total: 0 } });
    }

    // Filters
    if (leaseId) {
      query = query.eq("lease_id", leaseId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // Pagination
    const { data, error: queryError, count } = await query
      .range(offset, offset + limit - 1);

    if (queryError) {
      console.error("[GET /api/deposits] Query error:", queryError);
      return NextResponse.json(
        { error: "Erreur lors de la récupération" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      deposits: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    });
  } catch (err: unknown) {
    console.error("[GET /api/deposits] Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/deposits — Create a security deposit
 */
const createSchema = z.object({
  lease_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
  payment_method: z.enum(["sepa_debit", "card", "bank_transfer", "check", "cash"]).optional(),
  paid_at: z.string().optional(),
});

export const POST = withSecurity(
  async function POST(request: Request) {
    try {
      const { user, error } = await getAuthenticatedUser(request);

      if (error || !user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }

      const serviceClient = getServiceClient();
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, role")
        .eq("user_id", user.id)
        .single();

      if (!profile || (profile as any).role !== "owner") {
        return NextResponse.json(
          { error: "Seuls les propriétaires peuvent enregistrer un dépôt de garantie" },
          { status: 403 }
        );
      }

      const body = await request.json();
      const validated = createSchema.parse(body);

      // Verify the lease belongs to this owner
      const { data: lease } = await serviceClient
        .from("leases")
        .select("id, property:properties(owner_id)")
        .eq("id", validated.lease_id)
        .single();

      if (!lease || (lease as any).property?.owner_id !== (profile as any).id) {
        return NextResponse.json(
          { error: "Bail non trouvé ou non autorisé" },
          { status: 403 }
        );
      }

      // Check no existing deposit for this lease
      const { data: existing } = await serviceClient
        .from("security_deposits")
        .select("id")
        .eq("lease_id", validated.lease_id)
        .not("status", "eq", "returned")
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "Un dépôt de garantie existe déjà pour ce bail" },
          { status: 409 }
        );
      }

      const { data: deposit, error: insertError } = await serviceClient
        .from("security_deposits")
        .insert({
          lease_id: validated.lease_id,
          tenant_id: validated.tenant_id,
          amount_cents: validated.amount_cents,
          payment_method: validated.payment_method || null,
          paid_at: validated.paid_at || null,
          status: validated.paid_at ? "received" : "pending",
        } as any)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      return NextResponse.json({ deposit }, { status: 201 });
    } catch (err: unknown) {
      if ((err as any).name === "ZodError") {
        return NextResponse.json(
          { error: "Données invalides", details: (err as any).errors },
          { status: 400 }
        );
      }
      console.error("[POST /api/deposits] Error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur serveur" },
        { status: 500 }
      );
    }
  },
  { routeName: "POST /api/deposits", csrf: true }
);
