// @ts-nocheck
/**
 * API Route: Demande de devis aux prestataires
 * POST /api/end-of-lease/renovation/devis
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const devisSchema = z.object({
  renovation_item_id: z.string().uuid(),
  providers: z.array(z.object({
    provider_id: z.string().uuid().optional(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
  })),
  message: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = devisSchema.parse(body);

    // Récupérer l'item de rénovation
    const { data: renovationItem, error: itemError } = await supabase
      .from("renovation_items")
      .select(`
        *,
        lease_end_process:lease_end_processes(
          id,
          property:properties(adresse_complete, ville)
        )
      `)
      .eq("id", validatedData.renovation_item_id)
      .single();

    if (itemError || !renovationItem) {
      return NextResponse.json({ error: "Élément de rénovation non trouvé" }, { status: 404 });
    }

    // Créer les demandes de devis
    const quotesToInsert = validatedData.providers.map((provider) => ({
      renovation_item_id: validatedData.renovation_item_id,
      lease_end_process_id: (renovationItem.lease_end_process as any).id,
      provider_id: provider.provider_id,
      provider_name: provider.name,
      provider_email: provider.email,
      provider_phone: provider.phone,
      amount: 0,
      tax_amount: 0,
      total_amount: 0,
      status: "pending",
      description: validatedData.message,
    }));

    const { data: quotes, error: insertError } = await supabase
      .from("renovation_quotes")
      .insert(quotesToInsert)
      .select();

    if (insertError) {
      throw insertError;
    }

    // Mettre à jour le statut de l'item de rénovation
    await supabase
      .from("renovation_items")
      .update({ status: "quote_requested" })
      .eq("id", validatedData.renovation_item_id);

    // TODO: Envoyer les emails aux prestataires
    // Pour chaque provider, envoyer un email avec les détails du travail
    // Cela peut être fait via un service d'email (Resend, SendGrid, etc.)

    return NextResponse.json({ 
      quotes: quotes || [],
      message: `${quotes?.length || 0} demande(s) de devis envoyée(s)`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API renovation/devis:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

