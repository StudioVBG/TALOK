// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
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

    // Créer un document
    await supabase.from("documents").insert({
      type: "attestation_assurance",
      lease_id,
      tenant_id: (profile as any)?.id,
      storage_path: uploadData.path,
      metadata: { insurance_policy_id: (policy as any)?.id },
    } as any);

    return NextResponse.json({ policy });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}





