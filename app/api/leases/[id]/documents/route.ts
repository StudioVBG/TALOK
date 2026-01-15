export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * GET /api/leases/[id]/documents - Récupérer les documents d'un bail
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = params.id;

    // Vérifier que l'utilisateur a accès à ce bail
    const { data: roommate } = await supabaseClient
      .from("roommates")
      .select("id")
      .eq("lease_id", leaseId as any)
      .eq("user_id", user.id as any)
      .maybeSingle();

    if (!roommate) {
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}





