/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export const runtime = "nodejs";

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { generateEDLHTML } from "@/lib/templates/edl";
import { mapDatabaseToEDLComplet } from "@/lib/mappers/edl-to-template";

/**
 * POST /api/signature/edl/[token]/preview
 * Génère l'aperçu HTML d'un EDL via token (sans auth requise)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const serviceClient = getServiceClient();

    // 1. Trouver la signature par token
    const { data: signatureEntry, error: sigError } = await serviceClient
      .from("edl_signatures")
      .select("*, edl:edl_id(*)")
      .eq("invitation_token", token)
      .single();

    if (sigError || !signatureEntry) {
      return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });
    }

    // Vérifier si le token a expiré (7 jours après l'envoi)
    const TOKEN_EXPIRATION_DAYS = 7;
    if ((signatureEntry as any).invitation_sent_at) {
      const sentDate = new Date((signatureEntry as any).invitation_sent_at);
      const expirationDate = new Date(sentDate.getTime() + TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
      if (new Date() > expirationDate) {
        return NextResponse.json(
          {
            error: "Ce lien d'invitation a expiré. Veuillez demander un nouveau lien au propriétaire.",
            expired_at: expirationDate.toISOString(),
          },
          { status: 410 }
        );
      }
    }

    const edlId = signatureEntry.edl_id;

    // 2. Récupérer les données complètes (copié de /api/edl/preview)
    const { data: edl, error } = await serviceClient
      .from("edl")
      .select(`
        *,
        lease:lease_id(
          *,
          property:properties(*),
          signers:lease_signers(
            *,
            profile:profiles(*)
          )
        )
      `)
      .eq("id", edlId)
      .single();

    if (error || !edl) {
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    // Récupérer les items, médias et signatures
    const [
      { data: items },
      { data: media },
      { data: signaturesRaw },
      { data: ownerProfile }
    ] = await Promise.all([
      serviceClient.from("edl_items").select("*").eq("edl_id", edlId),
      serviceClient.from("edl_media").select("*").eq("edl_id", edlId),
      serviceClient.from("edl_signatures").select("*, profile:profiles(*)").eq("edl_id", edlId),
      serviceClient.from("owner_profiles").select("*, profile:profiles(*)").eq("profile_id", edl.lease?.property?.owner_id || (edl as any).property_id).maybeSingle()
    ]);

    // 🔧 Générer des URLs signées pour les images de signature (bucket privé)
    for (const sig of (signaturesRaw || [])) {
      if (sig.signature_image_path) {
        const { data: signedUrlData } = await serviceClient.storage
          .from("documents")
          .createSignedUrl(sig.signature_image_path, 3600);
        
        if (signedUrlData?.signedUrl) {
          (sig as any).signature_image_url = signedUrlData.signedUrl;
          console.log("[EDL Token Preview] ✅ Generated signed URL for signature:", sig.signer_role);
        }
      }
    }

    // Mapper les données (on pourrait exporter mapDatabaseToEDLComplet mais ici on simplifie)
    const fullEdlData = mapDatabaseToEDLComplet(
      edl,
      ownerProfile,
      items || [],
      media || [],
      signaturesRaw || []
    );

    const html = generateEDLHTML(fullEdlData);

    return NextResponse.json({ html });
  } catch (error: unknown) {
    console.error("[EDL Token Preview] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de la génération de l'aperçu" },
      { status: 500 }
    );
  }
}


