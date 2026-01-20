export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/helpers/api-error";
import { z } from "zod";

// Schéma de validation défini localement avec tous les champs optionnels
// (équivalent à .partial() mais sans appel de méthode dynamique)
const chargeUpdateSchema = z.object({
  property_id: z.string().uuid().optional(),
  type: z.enum([
    "eau",
    "electricite",
    "copro",
    "taxe",
    "ordures",
    "assurance",
    "travaux",
    "energie",
    "autre",
  ]).optional(),
  montant: z.number().positive().optional(),
  periodicite: z.enum(["mensuelle", "trimestrielle", "annuelle"]).optional(),
  refacturable_locataire: z.boolean().optional(),
  categorie_charge: z
    .enum([
      "charges_locatives",
      "charges_non_recuperables",
      "taxes",
      "travaux_proprietaire",
      "travaux_locataire",
      "assurances",
      "energie",
    ])
    .optional(),
  eligible_pinel: z.boolean().optional(),
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: charge, error } = await supabase
      .from("charges")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;
    return NextResponse.json({ charge });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = chargeUpdateSchema.parse(body);

    const { data: charge, error } = await supabase
      .from("charges")
      .update(validated)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ charge });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { error } = await supabase.from("charges").delete().eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

