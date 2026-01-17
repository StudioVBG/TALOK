export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour l'upload de documents compliance
 * POST /api/provider/compliance/upload - Upload un fichier
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { documentTypeEnum } from '@/lib/validations/provider-compliance';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

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
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Parser le FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('document_type') as string | null;
    const issueDate = formData.get('issue_date') as string | null;
    const expirationDate = formData.get('expiration_date') as string | null;

    // Validations
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (!documentType) {
      return NextResponse.json({ error: 'Type de document requis' }, { status: 400 });
    }

    // Valider le type de document
    const typeValidation = documentTypeEnum.safeParse(documentType);
    if (!typeValidation.success) {
      return NextResponse.json({ error: 'Type de document invalide' }, { status: 400 });
    }

    // Vérifier la taille
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Le fichier ne doit pas dépasser ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 400 }
      );
    }

    // Vérifier le type MIME
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Type de fichier non autorisé. Formats acceptés: PDF, JPEG, PNG, WebP' },
        { status: 400 }
      );
    }

    // Générer le chemin du fichier
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const fileName = `${documentType}-${Date.now()}.${fileExt}`;
    const filePath = `provider-compliance/${profile.id}/${fileName}`;

    // Convertir le File en Buffer pour l'upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload vers Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: `Erreur d'upload: ${uploadError.message}` }, { status: 500 });
    }

    // Supprimer les anciens documents pending du même type
    await supabase
      .from('provider_compliance_documents')
      .delete()
      .eq('provider_profile_id', profile.id)
      .eq('document_type', documentType)
      .eq('verification_status', 'pending');

    // Créer l'enregistrement du document
    const { data: document, error: createError } = await supabase
      .from('provider_compliance_documents')
      .insert({
        provider_profile_id: profile.id,
        document_type: documentType,
        storage_path: filePath,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        issue_date: issueDate || null,
        expiration_date: expirationDate || null,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (createError) {
      // Nettoyer le fichier uploadé en cas d'erreur
      await supabase.storage.from('documents').remove([filePath]);
      console.error('Error creating document record:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Mettre à jour le statut KYC
    await supabase.rpc('update_provider_kyc_status', {
      p_provider_profile_id: profile.id,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/compliance/upload:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

