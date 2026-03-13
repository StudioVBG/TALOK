export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { chargeSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/helpers/api-error";
import type { z } from "zod";

export async function GET(request: Request) {
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

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");

    if (propertyId && profile.role === "owner") {
      const { data: prop } = await supabase
        .from("properties")
        .select("id")
        .eq("id", propertyId)
        .eq("owner_id", profile.id)
        .maybeSingle();

      if (!prop) {
        return NextResponse.json({ error: "Accès refusé à ce logement" }, { status: 403 });
      }
    }

    let query = supabase.from("charges").select("*").order("created_at", { ascending: false });

    if (propertyId) {
      query = query.eq("property_id", propertyId);
    } else if (profile.role === "owner") {
      const { data: ownerProps } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", profile.id);
      const propIds = (ownerProps || []).map((p: { id: string }) => p.id);
      if (propIds.length > 0) {
        query = query.in("property_id", propIds);
      } else {
        return NextResponse.json({ charges: [] });
      }
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ charges: data });
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

    const body = await request.json();
    const validated = chargeSchema.parse(body);

    const { data: charge, error } = await supabase
      .from("charges")
      .insert(validated as any)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ charge });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

