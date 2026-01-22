export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/applications/[id]/extract-age - Extraire et calculer l'âge depuis les documents OCR
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer l'application et les champs extraits
    const { data: application } = await supabase
      .from("tenant_applications")
      .select(`
        id,
        tenant_profile_id,
        extracted_json,
        confidence
      `)
      .eq("id", id as any)
      .single();

    if (!application) {
      return NextResponse.json(
        { error: "Application non trouvée" },
        { status: 404 }
      );
    }

    // Récupérer les champs extraits depuis la table extracted_fields
    const { data: extractedFields } = await supabase
      .from("extracted_fields")
      .select("*")
      .eq("application_id", id as any)
      // @ts-ignore - Supabase typing issue
      .eq("field_name", "birthdate");

    if (!extractedFields || extractedFields.length === 0) {
      return NextResponse.json(
        { error: "Aucune date de naissance trouvée dans les documents" },
        { status: 404 }
      );
    }

    // Prendre la date avec la meilleure confiance
    const extractedFieldsData = extractedFields as any[];
    const bestField = extractedFieldsData.reduce((best: any, current: any) => {
      return (current.confidence || 0) > (best.confidence || 0) ? current : best;
    });

    if (!bestField.field_value) {
      return NextResponse.json(
        { error: "Date de naissance invalide" },
        { status: 400 }
      );
    }

    // Parser la date (peut être en différents formats)
    let birthdate: Date;
    try {
      birthdate = new Date(bestField.field_value);
      if (isNaN(birthdate.getTime())) {
        // Essayer format DD/MM/YYYY
        const [day, month, year] = bestField.field_value.split(/[\/\-]/);
        birthdate = new Date(`${year}-${month}-${day}`);
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Format de date invalide" },
        { status: 400 }
      );
    }

    // Calculer l'âge
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const monthDiff = today.getMonth() - birthdate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
      age--;
    }

    // Stocker dans user_ages
    const { data: userAge, error: ageError } = await supabase
      .from("user_ages")
      .upsert({
        profile_id: (application as any).tenant_profile_id,
        birthdate: birthdate.toISOString().split("T")[0],
        age,
        source: "ocr",
        confidence: bestField.confidence || 0,
        extracted_at: new Date().toISOString(),
      } as any, {
        onConflict: "profile_id",
      })
      .select()
      .single();

    if (ageError) throw ageError;

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "User.AgeCalculated",
      payload: {
        profile_id: (application as any).tenant_profile_id,
        age,
        birthdate: birthdate.toISOString().split("T")[0],
        confidence: bestField.confidence,
      },
    } as any);

    return NextResponse.json({
      success: true,
      age,
      birthdate: birthdate.toISOString().split("T")[0],
      confidence: bestField.confidence,
      user_age: userAge,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

