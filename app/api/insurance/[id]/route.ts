export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { withSecurity } from "@/lib/api/with-security";
import { INSURANCE_TYPES } from "@/lib/insurance/types";

const updateSchema = z.object({
  insurance_type: z.enum(INSURANCE_TYPES).optional(),
  insurer_name: z.string().min(1).max(200).optional(),
  policy_number: z.string().max(100).optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount_covered_cents: z.number().int().positive().optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  lease_id: z.string().uuid().optional().nullable(),
  document_id: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/insurance/[id] — Detail d'une police
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const { data: policy, error: queryError } = await supabase
      .from("insurance_policies")
      .select("*, properties(adresse_complete, ville), documents(id, title, storage_path)")
      .eq("id", id)
      .eq("profile_id", profile.id)
      .single();

    if (queryError || !policy) {
      return NextResponse.json({ error: "Assurance introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: policy });
  } catch (err) {
    console.error("GET /api/insurance/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PUT /api/insurance/[id] — Modifier une police
 */
export const PUT = withSecurity(async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Verifier dates si les deux sont fournies
    if (parsed.data.start_date && parsed.data.end_date) {
      if (new Date(parsed.data.end_date) <= new Date(parsed.data.start_date)) {
        return NextResponse.json(
          { error: "La date de fin doit etre posterieure a la date de debut" },
          { status: 400 }
        );
      }
    }

    const { data: policy, error: updateError } = await supabase
      .from("insurance_policies")
      .update(parsed.data)
      .eq("id", id)
      .eq("profile_id", profile.id)
      .select()
      .single();

    if (updateError || !policy) {
      return NextResponse.json({ error: "Assurance introuvable ou erreur de mise a jour" }, { status: 404 });
    }

    return NextResponse.json({ data: policy });
  } catch (err) {
    console.error("PUT /api/insurance/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { routeName: "PUT /api/insurance/[id]" });

/**
 * DELETE /api/insurance/[id] — Supprimer une police
 */
export const DELETE = withSecurity(async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("insurance_policies")
      .delete()
      .eq("id", id)
      .eq("profile_id", profile.id);

    if (deleteError) {
      console.error("DELETE /api/insurance/[id] error:", deleteError);
      return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/insurance/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { routeName: "DELETE /api/insurance/[id]" });
