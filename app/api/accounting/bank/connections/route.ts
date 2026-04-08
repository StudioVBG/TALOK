// @ts-nocheck
/**
 * API Route: Bank Connections
 * GET /api/accounting/bank/connections - List bank connections for an entity
 * POST /api/accounting/bank/connections - Create a new bank connection (Nordigen)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { createRequisition, getInstitutions } from "@/lib/bank/nordigen";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Connection limits per plan (open_banking_level)
// ---------------------------------------------------------------------------

const CONNECTION_LIMITS: Record<string, number> = {
  basic: 3,     // Confort
  advanced: 10, // Pro
  premium: -1,  // Enterprise (unlimited)
  none: 0,      // No open banking
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CreateConnectionSchema = z.object({
  institutionId: z.string().min(1),
  entityId: z.string().uuid(),
  accountType: z.enum(["checking", "savings", "other"]).default("checking"),
  accountLabel: z.string().max(255).optional(),
  accountingAccount: z.string().max(10).optional(),
});

// ---------------------------------------------------------------------------
// GET — List connections for entity
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    // Feature gate: open_banking required
    const featureGate = await requireAccountingAccess(profile.id, "open_banking");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");

    if (!entityId) {
      throw new ApiError(400, "entityId requis");
    }

    const { data: connections, error } = await (supabase as any)
      .from("bank_connections")
      .select("*")
      .eq("entity_id", entityId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Bank Connections] Fetch error:", error);
      throw new ApiError(500, "Erreur lors de la recuperation des connexions");
    }

    return NextResponse.json({
      success: true,
      data: connections || [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST — Create new connection
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      throw new ApiError(403, "Acces reserve aux administrateurs");
    }

    // Feature gate: open_banking required
    const featureGate = await requireAccountingAccess(profile.id, "open_banking");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = CreateConnectionSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { institutionId, entityId, accountType, accountLabel } = validation.data;

    // -----------------------------------------------------------------------
    // Check connection count vs plan limit
    // -----------------------------------------------------------------------

    const { data: subscription } = await (supabase as any)
      .from("subscriptions")
      .select("plan_slug, metadata")
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .single();

    const planSlug = subscription?.plan_slug ?? "gratuit";

    // Dynamically import plans to get open_banking_level
    const { PLANS } = await import("@/lib/subscriptions/plans");
    const plan = PLANS[planSlug as keyof typeof PLANS];
    const obLevel = (plan?.features as Record<string, unknown>)?.open_banking_level as string ?? "none";
    const maxConnections = CONNECTION_LIMITS[obLevel] ?? 0;

    if (maxConnections === 0) {
      throw new ApiError(403, "Votre forfait ne permet pas l'Open Banking");
    }

    if (maxConnections > 0) {
      const { count } = await (supabase as any)
        .from("bank_connections")
        .select("*", { count: "exact", head: true })
        .eq("entity_id", entityId)
        .eq("is_active", true);

      if ((count ?? 0) >= maxConnections) {
        throw new ApiError(
          403,
          `Limite de ${maxConnections} connexions bancaires atteinte pour votre forfait "${planSlug}". Passez au plan superieur.`,
        );
      }
    }

    // -----------------------------------------------------------------------
    // Resolve institution name
    // -----------------------------------------------------------------------

    let bankName = accountLabel ?? "Banque";
    try {
      const institutions = await getInstitutions("fr");
      const inst = institutions.find((i) => i.id === institutionId);
      if (inst) bankName = inst.name;
    } catch {
      // Non-blocking: use fallback name
    }

    // -----------------------------------------------------------------------
    // Create Nordigen requisition
    // -----------------------------------------------------------------------

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/accounting/bank/callback`;

    const requisition = await createRequisition(institutionId, redirectUri, entityId);

    // -----------------------------------------------------------------------
    // Insert bank_connections row
    // -----------------------------------------------------------------------

    const { data: connection, error: insertError } = await (supabase as any)
      .from("bank_connections")
      .insert({
        entity_id: entityId,
        provider: "nordigen",
        provider_connection_id: requisition.id,
        bank_name: bankName,
        iban_hash: `pending_${requisition.id}`, // Placeholder until callback resolves real IBAN
        account_type: accountType,
        sync_status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Bank Connections] Insert error:", insertError);
      throw new ApiError(500, "Erreur lors de la creation de la connexion");
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          connectionId: connection.id,
          authLink: requisition.link,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
