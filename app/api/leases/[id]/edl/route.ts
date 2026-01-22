export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/leases/[id]/edl - Récupérer les EDL d'un bail
 * Query params:
 *   - type: "entree" | "sortie" (optionnel, filtre par type)
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "entree" | "sortie"

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier l'accès au bail
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        id,
        property:properties!inner(id, owner_id)
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const leaseData = lease as any;
    const isOwner = leaseData.property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";

    // Vérifier si locataire
    let isTenant = false;
    if (!isOwner && !isAdmin) {
      const { data: signer } = await supabase
        .from("lease_signers")
        .select("id")
        .eq("lease_id", leaseId)
        .eq("profile_id", profile.id)
        .single();
      
      isTenant = !!signer;
    }

    if (!isOwner && !isAdmin && !isTenant) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Construire la query
    let query = supabase
      .from("edl")
      .select(`
        *,
        edl_items(
          id,
          room_name,
          item_name,
          condition,
          notes,
          created_at
        ),
        edl_media(
          id,
          item_id,
          storage_path,
          media_type,
          thumbnail_path,
          taken_at,
          section,
          created_at
        ),
        edl_signatures(
          id,
          signer_user,
          signer_role,
          signed_at
        )
      `)
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false });

    // Filtrer par type si spécifié
    if (type === "entree" || type === "sortie") {
      query = query.eq("type", type);
    }

    const { data: edls, error: edlsError } = await query;

    if (edlsError) {
      console.error("[GET /api/leases/[id]/edl]", edlsError);
      return NextResponse.json(
        { error: edlsError.message || "Erreur lors de la récupération des EDL" },
        { status: 500 }
      );
    }

    // Si on demande un type spécifique, retourner le premier (le plus récent)
    if (type) {
      const edl = edls && edls.length > 0 ? edls[0] : null;
      
      if (edl) {
        // Transformer les médias avec les URLs publiques
        const transformedMedia = (edl.edl_media || []).map((media: any) => ({
          ...media,
          url: getPublicUrl(media.storage_path),
        }));

        return NextResponse.json({
          edl: {
            ...edl,
            media: transformedMedia,
            items: edl.edl_items || [],
            signatures: edl.edl_signatures || [],
          },
        });
      }
      
      return NextResponse.json({ edl: null });
    }

    // Sinon retourner tous les EDL
    const transformedEdls = (edls || []).map((edl: any) => ({
      ...edl,
      media: (edl.edl_media || []).map((media: any) => ({
        ...media,
        url: getPublicUrl(media.storage_path),
      })),
      items: edl.edl_items || [],
      signatures: edl.edl_signatures || [],
    }));

    return NextResponse.json({ edls: transformedEdls });
  } catch (error: unknown) {
    console.error("[GET /api/leases/[id]/edl]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leases/[id]/edl - Créer un nouvel EDL pour un bail
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const leaseId = id;
    const body = await request.json();
    const { type, scheduled_date } = body;

    if (!type || !["entree", "sortie"].includes(type)) {
      return NextResponse.json(
        { error: "Type d'EDL invalide (entree ou sortie requis)" },
        { status: 400 }
      );
    }

    // Vérifier les permissions (propriétaire uniquement)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        id,
        property:properties!inner(id, owner_id)
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const leaseData = lease as any;
    const isOwner = leaseData.property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut créer un EDL" },
        { status: 403 }
      );
    }

    // Vérifier qu'il n'existe pas déjà un EDL du même type non terminé
    const { data: existingEdl } = await supabase
      .from("edl")
      .select("id, status")
      .eq("lease_id", leaseId)
      .eq("type", type)
      .in("status", ["draft", "in_progress"])
      .single();

    if (existingEdl) {
      return NextResponse.json(
        { 
          error: `Un EDL ${type === "entree" ? "d'entrée" : "de sortie"} est déjà en cours`,
          existing_edl_id: existingEdl.id,
        },
        { status: 409 }
      );
    }

    // Créer l'EDL
    const { data: newEdl, error: createError } = await supabase
      .from("edl")
      .insert({
        lease_id: leaseId,
        type,
        status: "draft",
        scheduled_date: scheduled_date || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("[POST /api/leases/[id]/edl]", createError);
      return NextResponse.json(
        { error: createError.message || "Erreur lors de la création de l'EDL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ edl: newEdl }, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/leases/[id]/edl]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

// Helper pour générer l'URL publique
function getPublicUrl(storagePath: string): string {
  if (!storagePath) return "";
  if (storagePath.startsWith("http")) return storagePath;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return storagePath;
  
  return `${supabaseUrl}/storage/v1/object/public/documents/${storagePath}`;
}

