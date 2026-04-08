export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { createTaskSchema } from "@/features/colocation/types";

/**
 * GET /api/colocation/tasks?property_id=xxx
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const url = new URL(request.url);
    const propertyId = url.searchParams.get("property_id");
    if (!propertyId) {
      return NextResponse.json({ error: "property_id requis" }, { status: 400 });
    }

    const { data: tasks, error: dbError } = await supabase
      .from("colocation_tasks")
      .select(`
        *,
        assigned_member:assigned_member_id(
          id,
          tenant_profile_id,
          profiles:tenant_profile_id(prenom, nom, avatar_url)
        ),
        completed_profile:completed_by(prenom, nom)
      `)
      .eq("property_id", propertyId)
      .order("sort_order", { ascending: true });

    if (dbError) throw dbError;
    return NextResponse.json({ tasks: tasks || [] });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/colocation/tasks
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: task, error: insertError } = await supabase
      .from("colocation_tasks")
      .insert(parsed.data)
      .select()
      .single();

    if (insertError) throw insertError;
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
