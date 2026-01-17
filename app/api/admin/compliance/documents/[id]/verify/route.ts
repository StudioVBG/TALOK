export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route Admin - Vérifier/Rejeter un document
 * POST /api/admin/compliance/documents/[id]/verify - Approuver ou rejeter
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDocumentSchema } from '@/lib/validations/provider-compliance';

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const documentId = params.id;

    // Parser et valider le body
    const body = await request.json();
    const validationResult = verifyDocumentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { action, rejection_reason } = validationResult.data;

    // Récupérer le document
    const { data: document, error: docError } = await supabase
      .from('provider_compliance_documents')
      .select('*, provider_profile_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 });
    }

    // Vérifier que le document est en attente
    if (document.verification_status !== 'pending') {
      return NextResponse.json(
        { error: 'Ce document a déjà été traité' },
        { status: 400 }
      );
    }

    // Préparer les données de mise à jour
    const updateData: Record<string, unknown> = {
      verification_status: action === 'approve' ? 'verified' : 'rejected',
      verified_at: new Date().toISOString(),
      verified_by: user.id,
    };

    if (action === 'reject') {
      if (!rejection_reason) {
        return NextResponse.json(
          { error: 'Un motif de rejet est requis' },
          { status: 400 }
        );
      }
      updateData.rejection_reason = rejection_reason;
    }

    // Mettre à jour le document
    const { data: updatedDoc, error: updateError } = await supabase
      .from('provider_compliance_documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating document:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Mettre à jour le statut KYC du prestataire
    await supabase.rpc('update_provider_kyc_status', {
      p_provider_profile_id: document.provider_profile_id,
    });

    // Créer une notification pour le prestataire
    const { data: providerProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', document.provider_profile_id)
      .single();

    if (providerProfile) {
      await supabase.from('notifications').insert({
        user_id: providerProfile.user_id,
        type: action === 'approve' ? 'document_approved' : 'document_rejected',
        title: action === 'approve' 
          ? 'Document validé' 
          : 'Document rejeté',
        body: action === 'approve'
          ? `Votre document "${document.document_type}" a été validé.`
          : `Votre document "${document.document_type}" a été rejeté. Motif: ${rejection_reason}`,
        payload: {
          document_id: documentId,
          document_type: document.document_type,
          action,
          rejection_reason,
        },
        channels: ['in_app', 'email'],
      });
    }

    // Log dans audit_log
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: action === 'approve' ? 'document.approved' : 'document.rejected',
      resource_type: 'provider_compliance_document',
      resource_id: documentId,
      metadata: {
        provider_profile_id: document.provider_profile_id,
        document_type: document.document_type,
        rejection_reason,
      },
    });

    return NextResponse.json({
      success: true,
      document: updatedDoc,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/admin/compliance/documents/[id]/verify:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

