export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les documents de compliance prestataire
 * GET /api/provider/compliance/documents - Liste des documents
 * POST /api/provider/compliance/documents - Upload d'un nouveau document
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { createComplianceDocumentSchema } from '@/lib/validations/provider-compliance';

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

    const serviceClient = getServiceClient();

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    if (profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { data: documents, error: docsError } = await serviceClient
      .from('provider_compliance_documents')
      .select('*')
      .eq('provider_profile_id', profile.id)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('[provider/compliance/documents] GET error:', docsError);
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    return NextResponse.json({ documents });
  } catch (error: unknown) {
    console.error('[provider/compliance/documents] GET handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    if (profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await request.json();

    const validationResult = createComplianceDocumentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const validated = validationResult.data;

    // Vérifier si un document du même type existe déjà et est vérifié
    const { data: existingDoc } = await serviceClient
      .from('provider_compliance_documents')
      .select('id, verification_status')
      .eq('provider_profile_id', profile.id)
      .eq('document_type', validated.document_type)
      .eq('verification_status', 'verified')
      .single();

    if (existingDoc) {
      return NextResponse.json(
        { error: 'Un document vérifié de ce type existe déjà. Contactez le support pour le remplacer.' },
        { status: 400 }
      );
    }

    // Supprimer les anciens documents pending du même type
    await serviceClient
      .from('provider_compliance_documents')
      .delete()
      .eq('provider_profile_id', profile.id)
      .eq('document_type', validated.document_type)
      .eq('verification_status', 'pending');

    const { data: document, error: createError } = await serviceClient
      .from('provider_compliance_documents')
      .insert({
        provider_profile_id: profile.id,
        ...validated,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (createError) {
      console.error('[provider/compliance/documents] POST create error:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    await serviceClient.rpc('update_provider_kyc_status', {
      p_provider_profile_id: profile.id,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: unknown) {
    console.error('[provider/compliance/documents] POST handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
