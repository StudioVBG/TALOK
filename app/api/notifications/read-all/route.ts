export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour marquer toutes les notifications comme lues
 * POST /api/notifications/read-all
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Marquer toutes comme lues
    const { data: count, error } = await supabase.rpc('mark_all_notifications_read', {
      p_profile_id: profile.id,
    });

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: count || 0,
      message: `${count || 0} notification(s) marquée(s) comme lue(s)`,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/notifications/read-all:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

