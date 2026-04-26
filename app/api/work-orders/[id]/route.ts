export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { workOrderSchema } from "@/lib/validations";

/**
 * Charge le work_order + le contexte d'accès (ticket, property owner) en
 * service-role, puis applique le check métier explicite.
 *
 * Le check RLS de Supabase ne suffit pas : tant qu'on appelle ces routes
 * sans cookie utilisateur valide ou avec une RLS récursive, la table
 * répondrait `null` sur le SELECT et l'ancien code retournait simplement
 * 500 ou — pire — laissait passer toute row visible côté RLS sans
 * vérifier que l'appelant en est vraiment provider/owner/admin.
 *
 * Pattern aligné avec PR #499 (tickets) et `docs/audits/rls-cascade-audit.md`.
 */
async function authorize(workOrderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };

  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return { error: NextResponse.json({ error: "Profil non trouvé" }, { status: 404 }) };
  }
  const profileData = profile as { id: string; role: string };

  const { data: workOrder } = await serviceClient
    .from("work_orders")
    .select(
      `
        *,
        ticket:tickets(
          id,
          owner_id,
          created_by_profile_id,
          assigned_to,
          property:properties(owner_id)
        )
      `,
    )
    .eq("id", workOrderId)
    .maybeSingle();

  if (!workOrder) {
    return { error: NextResponse.json({ error: "Work order non trouvé" }, { status: 404 }) };
  }
  const wo = workOrder as Record<string, unknown> & {
    provider_id?: string | null;
    ticket?: {
      owner_id?: string | null;
      created_by_profile_id?: string | null;
      assigned_to?: string | null;
      property?: { owner_id?: string | null } | null;
    } | null;
  };

  const isAdmin = profileData.role === "admin";
  const isProvider = wo.provider_id === profileData.id;
  const isOwner =
    wo.ticket?.property?.owner_id === profileData.id ||
    wo.ticket?.owner_id === profileData.id;
  const isCreator = wo.ticket?.created_by_profile_id === profileData.id;

  return {
    serviceClient,
    user,
    profile: profileData,
    workOrder: wo,
    isAdmin,
    isProvider,
    isOwner,
    isCreator,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await authorize(id);
    if ("error" in ctx) return ctx.error;

    if (!ctx.isAdmin && !ctx.isProvider && !ctx.isOwner && !ctx.isCreator) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    return NextResponse.json({ workOrder: ctx.workOrder });
  } catch (error: unknown) {
    console.error("[GET /work-orders/:id] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await authorize(id);
    if ("error" in ctx) return ctx.error;

    if (!ctx.isAdmin && !ctx.isProvider && !ctx.isOwner) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = workOrderSchema.partial().parse(body);

    const { data: workOrder, error } = await ctx.serviceClient
      .from("work_orders")
      .update(validated as Record<string, unknown>)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const validatedData = validated as { statut?: string };
    if (validatedData.statut === "done") {
      const updatedWo = workOrder as { id: string; ticket_id: string };
      await ctx.serviceClient
        .from("tickets")
        .update({ statut: "resolved" })
        .eq("id", updatedWo.ticket_id);

      await ctx.serviceClient.from("outbox").insert({
        event_type: "Ticket.Done",
        payload: {
          ticket_id: updatedWo.ticket_id,
          work_order_id: updatedWo.id,
        },
      });
    }

    return NextResponse.json({ workOrder });
  } catch (error: unknown) {
    if ((error as { name?: string }).name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: (error as { errors?: unknown }).errors },
        { status: 400 },
      );
    }
    console.error("[PUT /work-orders/:id] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await authorize(id);
    if ("error" in ctx) return ctx.error;

    // Suppression : owner ou admin uniquement (pas le provider, qui a juste
    // accepté/refusé/exécuté la mission).
    if (!ctx.isAdmin && !ctx.isOwner) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { error } = await ctx.serviceClient.from("work_orders").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /work-orders/:id] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}
