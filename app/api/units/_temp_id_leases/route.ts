/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * POST /api/units/[unitId]/leases - Créer un bail depuis un modèle
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { template_id, type_bail, loyer, charges_forfaitaires, depot_de_garantie, date_debut, date_fin, variables } = body;

    if (!type_bail || !loyer || !date_debut) {
      return NextResponse.json(
        { error: "type_bail, loyer et date_debut requis" },
        { status: 400 }
      );
    }

    // Récupérer l'unité
    const { data: unit } = await supabaseClient
      .from("units")
      .select(`
        id,
        property:properties!inner(id, owner_id)
      `)
      .eq("id", id as any)
      .single();

    if (!unit) {
      return NextResponse.json(
        { error: "Unité non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur est propriétaire
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;

    const unitData = unit as any;
    if (unitData.property.owner_id !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer le template si fourni
    let template = null;
    if (template_id) {
      const { data: templateData } = await supabaseClient
        .from("lease_templates")
        .select("*")
        .eq("id", template_id as any)
        .eq("is_active", true as any)
        .single();
      template = templateData;
    }

    // Créer le bail
    const { data: lease, error: leaseError } = await supabaseClient
      .from("leases")
      .insert({
        unit_id: id as any,
        type_bail,
        loyer,
        charges_forfaitaires: charges_forfaitaires || 0,
        depot_de_garantie: depot_de_garantie || 0,
        date_debut,
        date_fin: date_fin || null,
        statut: "draft" as any,
      } as any)
      .select()
      .single();

    if (leaseError) throw leaseError;

    const leaseData = lease as any;

    // Créer le draft depuis le template
    if (template) {
      const templateData = template as any;
      const { data: draft, error: draftError } = await supabaseClient
        .from("lease_drafts")
        .insert({
          lease_id: leaseData.id,
          template_id: templateData.id,
          version: 1,
          variables: variables || {},
        } as any)
        .select()
        .single();

      if (draftError) {
        console.error("Erreur création draft:", draftError);
        // Ne pas bloquer si le draft échoue
      } else {
        const draftData = draft as any;
        // Émettre un événement
        await supabaseClient.from("outbox").insert({
          event_type: "Lease.Drafted",
          payload: {
            lease_id: leaseData.id,
            draft_id: draftData.id,
            template_id: templateData.id,
          },
        } as any);
      }
    }

    // Ajouter le propriétaire comme signataire
    await supabaseClient.from("lease_signers").insert({
      lease_id: leaseData.id,
      profile_id: profileData.id,
      role: "proprietaire" as any,
      signature_status: "pending" as any,
    } as any);

    return NextResponse.json({ lease: leaseData });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





