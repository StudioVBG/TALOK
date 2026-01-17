export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * POST /api/insurance/upload - Uploader une attestation d'assurance
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const lease_id = formData.get("lease_id") as string | null;

    if (!file || !lease_id) {
      return NextResponse.json(
        { error: "file et lease_id requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est membre du bail
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", lease_id as any)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    if (!roommate) {
      return NextResponse.json(
        { error: "Vous n'êtes pas membre de ce bail" },
        { status: 403 }
      );
    }

    // 🔒 Récupérer property_id et owner_id via le bail pour la visibilité
    const serviceClient = getServiceClient();
    const { data: leaseWithProperty } = await serviceClient
      .from("leases")
      .select(`
        id,
        property_id,
        properties!inner(owner_id)
      `)
      .eq("id", lease_id)
      .single();

    const propertyId = leaseWithProperty?.property_id || null;
    const ownerId = (leaseWithProperty?.properties as any)?.owner_id || null;

    // Uploader le fichier
    const fileName = `insurance/${lease_id}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Récupérer les profils
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    // Créer ou mettre à jour la police d'assurance
    const { data: existing } = await supabase
      .from("insurance_policies")
      .select("id")
      .eq("lease_id", lease_id as any)
      .maybeSingle();

    let policy;
    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("insurance_policies")
        .update({
          certificate_url: uploadData.path,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", (existing as any).id)
        .select()
        .single();
      if (updateError) throw updateError;
      policy = updated;
    } else {
      const { data: created, error: createError } = await supabase
        .from("insurance_policies")
        .insert({
          lease_id,
          tenant_id: (profile as any)?.id,
          certificate_url: uploadData.path,
          status: "active",
        } as any)
        .select()
        .single();
      if (createError) throw createError;
      policy = created;
    }

    // Créer un document avec toutes les liaisons
    await serviceClient.from("documents").insert({
      type: "attestation_assurance",
      title: "Attestation d'assurance habitation",
      lease_id,
      property_id: propertyId,        // ✅ AJOUT - Permet au propriétaire de voir
      owner_id: ownerId,              // ✅ AJOUT - Liaison avec le propriétaire
      tenant_id: (profile as any)?.id,
      storage_path: uploadData.path,
      metadata: { 
        insurance_policy_id: (policy as any)?.id,
        uploaded_at: new Date().toISOString(),
      },
    } as any);

    return NextResponse.json({ policy });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





