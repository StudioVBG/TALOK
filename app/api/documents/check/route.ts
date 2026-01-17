export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/documents/check
 * 
 * Vérifie si un document existe déjà dans le système
 * PATTERN: Création unique → Lectures multiples
 * 
 * Cette API permet aux clients de vérifier l'existence d'un document
 * avant de demander sa génération, évitant ainsi les régénérations inutiles.
 * 
 * @body {
 *   type: 'quittance' | 'bail' | 'edl' | 'invoice' | 'attestation_assurance' | ...
 *   hash?: string - Hash du contenu pour vérification d'intégrité
 *   lease_id?: string
 *   property_id?: string
 *   payment_id?: string
 *   invoice_id?: string
 * }
 * 
 * @returns {
 *   exists: boolean
 *   url?: string - URL signée si le document existe
 *   path?: string - Chemin de stockage
 *   document_id?: string
 *   metadata?: object
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      type, 
      hash, 
      lease_id, 
      property_id, 
      owner_id, 
      tenant_id,
      payment_id,
      invoice_id,
    } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Le type de document est requis" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    // Construire la requête de recherche
    let query = serviceClient
      .from("documents")
      .select("id, storage_path, metadata, created_at")
      .eq("type", type);

    // Filtrer par hash si fourni
    if (hash) {
      query = query.or(`metadata->>hash.eq.${hash},content_hash.eq.${hash}`);
    }

    // Filtrer par références
    if (lease_id) query = query.eq("lease_id", lease_id);
    if (property_id) query = query.eq("property_id", property_id);
    if (owner_id) query = query.eq("owner_id", owner_id);
    if (tenant_id) query = query.eq("tenant_id", tenant_id);

    // Filtrer par metadata pour payment_id ou invoice_id
    if (payment_id) {
      query = query.filter("metadata->>payment_id", "eq", payment_id);
    }
    if (invoice_id) {
      query = query.filter("metadata->>invoice_id", "eq", invoice_id);
    }

    // Prendre le plus récent
    query = query.order("created_at", { ascending: false }).limit(1);

    const { data: existingDoc, error: queryError } = await query.maybeSingle();

    if (queryError) {
      console.error("[documents/check] Erreur requête:", queryError);
      return NextResponse.json({ exists: false });
    }

    if (!existingDoc?.storage_path) {
      return NextResponse.json({ 
        exists: false,
        message: "Document non trouvé, génération requise"
      });
    }

    // Vérifier que le fichier existe dans le storage
    const { data: fileInfo, error: fileError } = await serviceClient.storage
      .from("documents")
      .list(existingDoc.storage_path.split('/').slice(0, -1).join('/'), {
        search: existingDoc.storage_path.split('/').pop(),
      });

    if (fileError || !fileInfo || fileInfo.length === 0) {
      // Le fichier n'existe plus dans le storage, supprimer l'entrée
      await serviceClient
        .from("documents")
        .delete()
        .eq("id", existingDoc.id);

      return NextResponse.json({ 
        exists: false,
        message: "Fichier storage manquant, régénération requise"
      });
    }

    // Générer URL signée
    const { data: signedUrl, error: urlError } = await serviceClient.storage
      .from("documents")
      .createSignedUrl(existingDoc.storage_path, 3600); // 1h

    if (urlError) {
      console.error("[documents/check] Erreur génération URL:", urlError);
      return NextResponse.json({ 
        exists: true,
        document_id: existingDoc.id,
        path: existingDoc.storage_path,
        metadata: existingDoc.metadata,
        url: null,
        message: "Document trouvé mais erreur URL signée"
      });
    }

    return NextResponse.json({
      exists: true,
      document_id: existingDoc.id,
      url: signedUrl?.signedUrl,
      path: existingDoc.storage_path,
      metadata: existingDoc.metadata,
      created_at: existingDoc.created_at,
    });

  } catch (error: unknown) {
    console.error("[documents/check] Erreur:", error);
    return NextResponse.json(
      { exists: false, error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/check
 * 
 * Recherche rapide par query params
 * Ex: /api/documents/check?type=quittance&payment_id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const hash = searchParams.get("hash");
    const lease_id = searchParams.get("lease_id");
    const payment_id = searchParams.get("payment_id");

    if (!type) {
      return NextResponse.json(
        { error: "Le paramètre type est requis" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    let query = serviceClient
      .from("documents")
      .select("id, storage_path, metadata, created_at")
      .eq("type", type);

    if (hash) {
      query = query.or(`metadata->>hash.eq.${hash},content_hash.eq.${hash}`);
    }
    if (lease_id) query = query.eq("lease_id", lease_id);
    if (payment_id) {
      query = query.filter("metadata->>payment_id", "eq", payment_id);
    }

    const { data: existingDoc } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingDoc?.storage_path) {
      return NextResponse.json({ exists: false });
    }

    const { data: signedUrl } = await serviceClient.storage
      .from("documents")
      .createSignedUrl(existingDoc.storage_path, 3600);

    return NextResponse.json({
      exists: true,
      document_id: existingDoc.id,
      url: signedUrl?.signedUrl,
      path: existingDoc.storage_path,
    });

  } catch (error: unknown) {
    console.error("[documents/check] Erreur GET:", error);
    return NextResponse.json({ exists: false });
  }
}

