export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les notifications — SOTA BIC 2026
 * GET    /api/notifications - Liste des notifications
 * PATCH  /api/notifications - Marquer comme lu (une ou toutes)
 * DELETE /api/notifications - Supprimer une notification
 * POST   /api/notifications - Créer une notification (admin/système)
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

    // Récupérer le profil (maybeSingle pour éviter 406 si profil absent)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) {
      // Profil pas encore créé — retourner des notifications vides plutôt qu'une erreur
      return NextResponse.json({ notifications: [], unread_count: 0 });
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications - Marquer comme lu (une ou toutes)
 * ✅ SOTA BIC 2026
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    const body = await request.json();

    if (body.action === 'mark_all_read') {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('profile_id', profile.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (body.action === 'mark_read' && body.id) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', body.id)
        .eq('profile_id', profile.id);

      if (error) {
        console.error('Error marking as read:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error in PATCH /api/notifications:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/notifications - Supprimer une notification
 * ✅ SOTA BIC 2026
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', body.id)
      .eq('profile_id', profile.id);

    if (error) {
      console.error('Error deleting notification:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/notifications:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
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
      .maybeSingle();

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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}
