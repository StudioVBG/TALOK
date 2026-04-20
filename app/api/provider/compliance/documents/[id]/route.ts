export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour un document de compliance spécifique
 * GET /api/provider/compliance/documents/[id] - Détails d'un document
 * DELETE /api/provider/compliance/documents/[id] - Supprimer un document (si pending)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { STORAGE_BUCKETS } from '@/lib/config/storage-buckets';

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    const documentId = params.id;

    const { data: document, error: docError } = await serviceClient
      .from('provider_compliance_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 });
    }

    if (profile.role !== 'admin' && document.provider_profile_id !== profile.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Générer une URL signée pour le fichier (storage accepte service client)
    let signedUrl = null;
    if (document.storage_path) {
      const { data: urlData } = await serviceClient.storage
        .from('documents')
        .createSignedUrl(document.storage_path as string, 3600);

      signedUrl = urlData?.signedUrl;
    }

    return NextResponse.json({
      document: {
        ...document,
        signed_url: signedUrl,
      },
    });
  } catch (error: unknown) {
    console.error('[provider/compliance/documents/[id]] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const documentId = params.id;

    const { data: document } = await serviceClient
      .from('provider_compliance_documents')
      .select('*')
      .eq('id', documentId)
      .eq('provider_profile_id', profile.id)
      .single();

    if (!document) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 });
    }

    if (document.verification_status !== 'pending') {
      return NextResponse.json(
        { error: 'Seuls les documents en attente peuvent être supprimés' },
        { status: 400 }
      );
    }

    if (document.storage_path) {
      await serviceClient.storage
        .from(STORAGE_BUCKETS.DOCUMENTS)
        .remove([document.storage_path as string]);
    }

    const { error: deleteError } = await serviceClient
      .from('provider_compliance_documents')
      .delete()
      .eq('id', documentId)
      .eq('provider_profile_id', profile.id);

    if (deleteError) {
      console.error('[provider/compliance/documents/[id]] DELETE error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await serviceClient.rpc('update_provider_kyc_status', {
      p_provider_profile_id: profile.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[provider/compliance/documents/[id]] DELETE handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
