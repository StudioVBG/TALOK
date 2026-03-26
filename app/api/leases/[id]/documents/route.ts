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

    // Récupérer le profil de l'utilisateur
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;
    const isAdmin = profileData.role === "admin";

    // Vérifier l'accès via lease_signers ou ownership
    let hasAccess = isAdmin;
    let isTenant = false;

    if (!hasAccess) {
      // Vérifier si signataire du bail
      const { data: signer } = await supabaseClient
        .from("lease_signers")
        .select("id, role")
        .eq("lease_id", leaseId as any)
        .eq("profile_id", profileData.id as any)
        .maybeSingle();

      if (signer) {
        hasAccess = true;
        isTenant = ["locataire_principal", "locataire", "colocataire"].includes((signer as any).role);
      }
    }

    if (!hasAccess) {
      // Vérifier si propriétaire de la propriété du bail
      const { data: lease } = await supabaseClient
        .from("leases")
        .select("property_id")
        .eq("id", leaseId as any)
        .single();

      if (lease) {
        const { data: property } = await supabaseClient
          .from("properties")
          .select("id")
          .eq("id", (lease as any).property_id as any)
          .eq("owner_id", profileData.id as any)
          .maybeSingle();
        hasAccess = !!property;
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer les documents du bail
    let docsQuery = supabaseClient
      .from("documents")
      .select("*")
      .eq("lease_id", leaseId as any);

    // Filtrer visible_tenant pour les locataires
    if (isTenant) {
      docsQuery = docsQuery.eq("visible_tenant", true);
    }

    const { data: documents, error } = await docsQuery
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





