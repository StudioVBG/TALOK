export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Route Admin - Documents en attente de validation
 * GET /api/admin/compliance/documents/pending - Liste des documents à valider
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Paramètres de pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Récupérer les documents en attente avec les infos du prestataire
    const { data: documents, error: docsError, count } = await supabase
      .from('provider_compliance_documents')
      .select(
        `
        *,
        provider:profiles!provider_compliance_documents_provider_profile_id_fkey (
          id,
          prenom,
          nom,
          telephone,
          user_id
        )
      `,
        { count: 'exact' }
      )
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (docsError) {
      console.error('Error fetching pending documents:', docsError);
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    // Formater les données
    const formattedDocs = (documents || []).map((doc: any) => ({
      id: doc.id,
      document_type: doc.document_type,
      storage_path: doc.storage_path,
      original_filename: doc.original_filename,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      issue_date: doc.issue_date,
      expiration_date: doc.expiration_date,
      created_at: doc.created_at,
      provider: {
        id: doc.provider?.id,
        name: `${doc.provider?.prenom || ''} ${doc.provider?.nom || ''}`.trim() || 'Inconnu',
        telephone: doc.provider?.telephone,
      },
    }));

    return NextResponse.json({
      documents: formattedDocs,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/admin/compliance/documents/pending:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

