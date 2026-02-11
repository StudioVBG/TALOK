export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * GET /api/leases/[id]/documents - Récupérer les documents d'un bail
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
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

    const leaseId = id;

    // Vérifier que l'utilisateur a accès à ce bail (propriétaire, locataire ou colocataire)
    // 1. Vérifier si c'est le propriétaire du bien lié au bail
    const { data: leaseProperty } = await supabaseClient
      .from("leases")
      .select("property_id, properties!leases_property_id_fkey(owner_id)")
      .eq("id", leaseId as any)
      .single();

    const { data: userProfile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const isOwner = userProfile && (leaseProperty as any)?.properties?.owner_id === userProfile.id;

    // 2. Vérifier si c'est un colocataire/locataire
    const { data: roommate } = await supabaseClient
      .from("roommates")
      .select("id")
      .eq("lease_id", leaseId as any)
      .eq("user_id", user.id as any)
      .maybeSingle();

    // 3. Vérifier si c'est un signataire du bail
    const { data: signer } = await supabaseClient
      .from("lease_signers")
      .select("id")
      .eq("lease_id", leaseId as any)
      .eq("profile_id", userProfile?.id as any)
      .maybeSingle();

    if (!isOwner && !roommate && !signer) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer les documents
    const { data: documents, error } = await supabaseClient
      .from("documents")
      .select("*")
      .eq("lease_id", leaseId as any)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Générer des URLs signées pour le téléchargement
    const documentsWithUrls = await Promise.all(
      (documents || []).map(async (doc: any) => {
        if (doc.storage_path) {
          const { data: signedUrl } = await supabaseClient.storage
            .from("documents")
            .createSignedUrl(doc.storage_path, 3600); // 1 heure

          return {
            ...doc,
            download_url: signedUrl?.signedUrl || null,
          };
        }
        return doc;
      })
    );

    return NextResponse.json({ documents: documentsWithUrls });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





