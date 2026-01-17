export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour un document de compliance spécifique
 * GET /api/provider/compliance/documents/[id] - Détails d'un document
 * DELETE /api/provider/compliance/documents/[id] - Supprimer un document (si pending)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    const documentId = params.id;

    // Récupérer le document
    const { data: document, error: docError } = await supabase
      .from('provider_compliance_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 });
    }

    // Vérifier l'accès (propriétaire ou admin)
    if (profile.role !== 'admin' && document.provider_profile_id !== profile.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Générer une URL signée pour le fichier
    let signedUrl = null;
    if (document.storage_path) {
      const { data: urlData } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.storage_path, 3600); // 1 heure

      signedUrl = urlData?.signedUrl;
    }

    return NextResponse.json({
      document: {
        ...document,
        signed_url: signedUrl,
      },
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/compliance/documents/[id]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
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

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const documentId = params.id;

    // Récupérer le document
    const { data: document } = await supabase
      .from('provider_compliance_documents')
      .select('*')
      .eq('id', documentId)
      .eq('provider_profile_id', profile.id)
      .single();

    if (!document) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 });
    }

    // Seuls les documents en attente peuvent être supprimés
    if (document.verification_status !== 'pending') {
      return NextResponse.json(
        { error: 'Seuls les documents en attente peuvent être supprimés' },
        { status: 400 }
      );
    }

    // Supprimer le fichier du storage
    if (document.storage_path) {
      await supabase.storage.from('documents').remove([document.storage_path]);
    }

    // Supprimer le document de la base
    const { error: deleteError } = await supabase
      .from('provider_compliance_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      console.error('Error deleting document:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Mettre à jour le statut KYC
    await supabase.rpc('update_provider_kyc_status', {
      p_provider_profile_id: profile.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/provider/compliance/documents/[id]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

