export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * @version 2026-01-22 - Fix: column names to match meter_readings table schema
 * meter_readings schema: meter_id, reading_value, unit, reading_date, photo_url, source, created_by
 */
const createReadingSchema = z.object({
  meter_id: z.string().uuid(),
  reading_value: z.number().min(0),
  reading_date: z.string(),
  photo_url: z.string().url().optional().nullable(),
  source: z.enum(['api', 'manual', 'ocr']).optional().default('manual'),
  unit: z.string().optional().default('kWh'),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const validated = createReadingSchema.parse(body);

    // Verify the meter belongs to a property the user has access to
    const { data: meter } = await supabase
      .from("meters")
      .select("id, property_id")
      .eq("id", validated.meter_id)
      .single();

    if (!meter) {
      return NextResponse.json({ error: "Compteur non trouvé" }, { status: 404 });
    }

    // For tenants, check they have an active lease for this property
    if (profile.role === "tenant") {
      const { data: leaseSigners } = await supabase
        .from("lease_signers")
        .select(`
          leases!inner(property_id, statut)
        `)
        .eq("profile_id", profile.id)
        .eq("leases.property_id", meter.property_id)
        .eq("leases.statut", "active")
        .limit(1);

      if (!leaseSigners || leaseSigners.length === 0) {
        return NextResponse.json(
          { error: "Vous n'avez pas accès à ce compteur" },
          { status: 403 }
        );
      }
    }

    // For owners, check they own the property
    if (profile.role === "owner") {
      const { data: property } = await supabase
        .from("properties")
        .select("id")
        .eq("id", meter.property_id)
        .eq("owner_id", profile.id)
        .single();

      if (!property) {
        return NextResponse.json(
          { error: "Vous n'avez pas accès à ce compteur" },
          { status: 403 }
        );
      }
    }

    // Create the reading - using correct column names from meter_readings table schema
    const { data: reading, error } = await supabase
      .from("meter_readings")
      .insert({
        meter_id: validated.meter_id,
        reading_value: validated.reading_value,
        unit: validated.unit,
        reading_date: validated.reading_date,
        photo_url: validated.photo_url,
        source: validated.source,
        created_by: user.id, // Use auth.user.id, not profile.id
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/meters/readings] Error:", error.message);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement du relevé" },
        { status: 500 }
      );
    }

    return NextResponse.json(reading, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/meters/readings] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const meterId = searchParams.get("meter_id");

    if (!meterId) {
      return NextResponse.json(
        { error: "meter_id requis" },
        { status: 400 }
      );
    }

    const { data: readings, error } = await supabase
      .from("meter_readings")
      .select("*")
      .eq("meter_id", meterId)
      .order("reading_date", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[GET /api/meters/readings] Error:", error.message);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des relevés" },
        { status: 500 }
      );
    }

    return NextResponse.json(readings);
  } catch (error: unknown) {
    console.error("[GET /api/meters/readings] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

