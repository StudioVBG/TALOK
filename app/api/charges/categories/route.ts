export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { chargeCategoryCreateSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/helpers/api-error";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");

    if (!propertyId) {
      return NextResponse.json(
        { error: "property_id requis" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    // Verify property access
    if ((profile as any).role === "owner") {
      const { data: prop } = await supabase
        .from("properties")
        .select("id")
        .eq("id", propertyId)
        .eq("owner_id", (profile as any).id)
        .maybeSingle();

      if (!prop) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from("charge_categories")
      .select("*")
      .eq("property_id", propertyId)
      .order("category", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ categories: data });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile as any).role !== "owner") {
      return NextResponse.json({ error: "Réservé aux propriétaires" }, { status: 403 });
    }

    const body = await request.json();
    const validated = chargeCategoryCreateSchema.parse(body);

    // Verify property ownership
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("id", validated.property_id)
      .eq("owner_id", (profile as any).id)
      .maybeSingle();

    if (!prop) {
      return NextResponse.json({ error: "Bien non trouvé" }, { status: 404 });
    }

    const { data: category, error } = await supabase
      .from("charge_categories")
      .insert(validated as any)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
