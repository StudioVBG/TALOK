export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les documents de compliance prestataire
 * GET /api/provider/compliance/documents - Liste des documents
 * POST /api/provider/compliance/documents - Upload d'un nouveau document
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    // Récupérer le profil prestataire
    const { data: profile, error: profileError } = await supabase
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

    // Récupérer les documents
    const { data: documents, error: docsError } = await supabase
      .from('provider_compliance_documents')
      .select('*')
      .eq('provider_profile_id', profile.id)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    return NextResponse.json({ documents });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/compliance/documents:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
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

    // Récupérer le profil prestataire
    const { data: profile, error: profileError } = await supabase
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

    // Parser le body
    const body = await request.json();

    // Valider les données
    const validationResult = createComplianceDocumentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const validated = validationResult.data;

    // Vérifier si un document du même type existe déjà et est vérifié
    const { data: existingDoc } = await supabase
      .from('provider_compliance_documents')
      .select('id, verification_status')
      .eq('provider_profile_id', profile.id)
      .eq('document_type', validated.document_type)
      .eq('verification_status', 'verified')
      .single();

    // Si un document vérifié existe, on ne peut pas en ajouter un nouveau du même type
    // sauf si l'ancien est expiré
    if (existingDoc) {
      return NextResponse.json(
        { error: 'Un document vérifié de ce type existe déjà. Contactez le support pour le remplacer.' },
        { status: 400 }
      );
    }

    // Supprimer les anciens documents pending du même type
    await supabase
      .from('provider_compliance_documents')
      .delete()
      .eq('provider_profile_id', profile.id)
      .eq('document_type', validated.document_type)
      .eq('verification_status', 'pending');

    // Créer le document
    const { data: document, error: createError } = await supabase
      .from('provider_compliance_documents')
      .insert({
        provider_profile_id: profile.id,
        ...validated,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating document:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Mettre à jour le statut KYC
    await supabase.rpc('update_provider_kyc_status', {
      p_provider_profile_id: profile.id,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/compliance/documents:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

