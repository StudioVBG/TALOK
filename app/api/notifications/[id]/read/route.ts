export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour marquer une notification comme lue
 * POST /api/notifications/[id]/read
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const notificationId = params.id;

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Marquer comme lue
    const { data: success, error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId,
      p_profile_id: profile.id,
    });

    if (error) {
      console.error('Error marking notification as read:', error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ success: success || false });
  } catch (error: unknown) {
    console.error('Error in POST /api/notifications/[id]/read:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

