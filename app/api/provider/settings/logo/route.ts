export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour le logo entreprise du prestataire
 * GET    /api/provider/settings/logo - Recupere l'URL actuelle du logo
 * POST   /api/provider/settings/logo - Upload (ou remplace) le logo
 * DELETE /api/provider/settings/logo - Supprime le logo
 *
 * Stocke dans le bucket public "avatars" sous provider-logos/{profile_id}/.
 * Met a jour provider_profiles.company_logo_url avec l'URL publique.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { STORAGE_BUCKETS } from '@/lib/config/storage-buckets';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB - plus serre qu'un doc
const ALLOWED_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
];

const LOGO_FOLDER = 'provider-logos';

function pathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Acces non autorise' }, { status: 403 });
    }

    const { data: providerProfile } = await serviceClient
      .from('provider_profiles')
      .select('company_logo_url')
      .eq('profile_id', profile.id)
      .single();

    return NextResponse.json({
      company_logo_url: providerProfile?.company_logo_url ?? null,
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/settings/logo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Acces non autorise' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Le logo ne doit pas depasser ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format non supporte. Acceptes : JPEG, PNG, WebP, SVG' },
        { status: 400 },
      );
    }

    // Recuperer l'ancien logo pour suppression apres upload reussi
    const { data: existing } = await serviceClient
      .from('provider_profiles')
      .select('company_logo_url')
      .eq('profile_id', profile.id)
      .single();

    const ext =
      file.type === 'image/svg+xml'
        ? 'svg'
        : (file.name.split('.').pop()?.toLowerCase() || 'png');
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `${LOGO_FOLDER}/${profile.id}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await serviceClient.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[provider/settings/logo] Upload error:', uploadError);
      return NextResponse.json(
        { error: `Erreur d'upload: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const { data: publicData } = serviceClient.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // S'assurer qu'une row provider_profiles existe (upsert)
    const { error: upsertError } = await serviceClient
      .from('provider_profiles')
      .upsert(
        {
          profile_id: profile.id,
          company_logo_url: publicUrl,
        },
        { onConflict: 'profile_id' },
      );

    if (upsertError) {
      // Rollback storage
      await serviceClient.storage
        .from(STORAGE_BUCKETS.AVATARS)
        .remove([filePath]);
      console.error('[provider/settings/logo] DB upsert error:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Supprimer l'ancien logo si present et different
    if (existing?.company_logo_url && existing.company_logo_url !== publicUrl) {
      const oldPath = pathFromPublicUrl(existing.company_logo_url, STORAGE_BUCKETS.AVATARS);
      if (oldPath && oldPath.startsWith(`${LOGO_FOLDER}/${profile.id}/`)) {
        await serviceClient.storage
          .from(STORAGE_BUCKETS.AVATARS)
          .remove([oldPath]);
      }
    }

    return NextResponse.json({ company_logo_url: publicUrl }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/settings/logo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Acces non autorise' }, { status: 403 });
    }

    const { data: existing } = await serviceClient
      .from('provider_profiles')
      .select('company_logo_url')
      .eq('profile_id', profile.id)
      .single();

    if (!existing?.company_logo_url) {
      return NextResponse.json({ deleted: false });
    }

    const oldPath = pathFromPublicUrl(existing.company_logo_url, STORAGE_BUCKETS.AVATARS);
    if (oldPath && oldPath.startsWith(`${LOGO_FOLDER}/${profile.id}/`)) {
      await serviceClient.storage
        .from(STORAGE_BUCKETS.AVATARS)
        .remove([oldPath]);
    }

    const { error: updateError } = await serviceClient
      .from('provider_profiles')
      .update({ company_logo_url: null })
      .eq('profile_id', profile.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/provider/settings/logo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
