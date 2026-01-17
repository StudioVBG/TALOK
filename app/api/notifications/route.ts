export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les notifications
 * GET /api/notifications - Liste des notifications
 * POST /api/notifications - Créer une notification (admin/système)
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

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Paramètres
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Essayer d'abord avec la table notifications directement
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    // Si la table n'existe pas, retourner un tableau vide
    if (error) {
      console.warn('Notifications table not found or error:', error.message);
      return NextResponse.json({
        notifications: [],
        unread_count: 0,
      });
    }

    // Compter les non lues
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id)
      .eq('is_read', false);

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCount || 0,
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/notifications:', error);
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

    // Vérifier que c'est un admin ou une requête système
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await request.json();

    // Créer une notification via template
    if (body.template_code) {
      const { data: notificationId, error } = await supabase.rpc('create_notification_from_template', {
        p_profile_id: body.profile_id,
        p_template_code: body.template_code,
        p_variables: body.variables || {},
        p_data: body.data || {},
      });

      if (error) {
        console.error('Error creating notification from template:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
      }

      return NextResponse.json({ notification_id: notificationId }, { status: 201 });
    }

    // Créer une notification custom
    const { data: notification, error: createError } = await supabase
      .from('notifications')
      .insert({
        profile_id: body.profile_id,
        type: body.type,
        title: body.title,
        message: body.message,
        data: body.data || {},
        priority: body.priority || 'normal',
        action_url: body.action_url,
        action_label: body.action_label,
        channels_status: { in_app: 'pending' },
        status: 'pending',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating notification:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/notifications:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}
