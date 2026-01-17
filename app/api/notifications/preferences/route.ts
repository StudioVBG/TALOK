export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les préférences de notification
 * GET /api/notifications/preferences - Récupérer les préférences
 * PUT /api/notifications/preferences - Mettre à jour les préférences
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updatePreferencesSchema = z.object({
  in_app_enabled: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  notification_email: z.string().email().optional().nullable(),
  sms_phone: z.string().optional().nullable(),
  category_preferences: z.record(z.array(z.enum(['in_app', 'email', 'sms', 'push']))).optional(),
  disabled_templates: z.array(z.string()).optional(),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  quiet_hours_timezone: z.string().optional(),
  digest_mode: z.enum(['instant', 'daily', 'weekly']).optional(),
  digest_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  digest_day: z.number().min(0).max(6).optional().nullable(),
});

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

    // Récupérer les préférences (ou créer par défaut)
    let { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('profile_id', profile.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // Créer les préférences par défaut
      const { data: newPrefs, error: createError } = await supabase
        .from('notification_preferences')
        .insert({ profile_id: profile.id })
        .select()
        .single();

      if (createError) {
        console.error('Error creating preferences:', createError);
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      preferences = newPrefs;
    } else if (error) {
      console.error('Error fetching preferences:', error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    // Récupérer aussi les templates disponibles pour la config
    const { data: templates } = await supabase
      .from('notification_templates')
      .select('code, name, category, channels')
      .eq('is_active', true)
      .order('category');

    return NextResponse.json({
      preferences,
      templates: templates || [],
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/notifications/preferences:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    // Valider le body
    const body = await request.json();
    const validationResult = updatePreferencesSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Mettre à jour ou créer les préférences
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .upsert({
        profile_id: profile.id,
        ...data,
      }, {
        onConflict: 'profile_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating preferences:', error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ preferences });
  } catch (error: unknown) {
    console.error('Error in PUT /api/notifications/preferences:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

