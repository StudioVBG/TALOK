export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/email-templates/[id] — Récupérer un template par ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error: authError, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    const { data: template, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!template) {
      return NextResponse.json({ error: "Template non trouvé" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error: unknown) {
    console.error("[Admin Email Template GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/email-templates/[id] — Mettre à jour un template
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error: authError, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    const body = await request.json();
    const allowedFields = [
      "subject",
      "body_html",
      "body_text",
      "is_active",
      "send_delay_minutes",
      "name",
      "description",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    const { data: template, error } = await (supabase
      .from("email_templates") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ template });
  } catch (error: unknown) {
    console.error("[Admin Email Template PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
