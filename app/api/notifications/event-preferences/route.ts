export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les préférences de notification par événement
 *
 * GET  /api/notifications/event-preferences - Récupérer les préférences per-event
 * PUT  /api/notifications/event-preferences - Mettre à jour une préférence per-event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { EVENT_CATALOGUE, EVENT_CATEGORIES } from '@/lib/notifications/events';

const updateSchema = z.object({
  event_type: z.string().min(1),
  email_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
});

const bulkUpdateSchema = z.object({
  preferences: z.array(updateSchema),
});

/**
 * GET /api/notifications/event-preferences
 * Returns all per-event preferences for the current user + event catalogue metadata
 */
export async function GET() {
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

    // Fetch existing per-event preferences
    const { data: preferences, error } = await supabase
      .from('notification_event_preferences')
      .select('*')
      .eq('profile_id', profile.id);

    if (error) {
      console.error('Error fetching event preferences:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build the catalogue with defaults for events without preferences
    const prefsMap = new Map<string, Record<string, unknown>>(
      (preferences || []).map((p: any) => [p.event_type, p])
    );

    const catalogue = Object.entries(EVENT_CATALOGUE).map(([key, def]) => {
      const pref = prefsMap.get(key) as Record<string, boolean | string> | undefined;
      return {
        event_type: key,
        email_enabled: pref ? Boolean(pref.email_enabled) : def.defaultChannels.includes('email'),
        push_enabled: pref ? Boolean(pref.push_enabled) : def.defaultChannels.includes('push'),
        sms_enabled: pref ? Boolean(pref.sms_enabled) : def.defaultChannels.includes('sms'),
        in_app_enabled: pref ? Boolean(pref.in_app_enabled) : def.defaultChannels.includes('in_app'),
        default_channels: def.defaultChannels,
        priority: def.priority,
        has_custom_preference: !!pref,
      };
    });

    return NextResponse.json({
      preferences: catalogue,
      categories: EVENT_CATEGORIES,
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/notifications/event-preferences:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PUT /api/notifications/event-preferences
 * Upsert a single or multiple per-event preferences
 */
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    const body = await request.json();

    // Support single or bulk update
    const isBulk = body.preferences && Array.isArray(body.preferences);
    const items = isBulk
      ? bulkUpdateSchema.parse(body).preferences
      : [updateSchema.parse(body)];

    const results = [];

    for (const item of items) {
      // Validate event_type exists in catalogue
      if (!(item.event_type in EVENT_CATALOGUE)) {
        results.push({ event_type: item.event_type, error: 'Unknown event type' });
        continue;
      }

      const upsertData: Record<string, unknown> = {
        profile_id: profile.id,
        event_type: item.event_type,
      };

      if (item.email_enabled !== undefined) upsertData.email_enabled = item.email_enabled;
      if (item.push_enabled !== undefined) upsertData.push_enabled = item.push_enabled;
      if (item.sms_enabled !== undefined) upsertData.sms_enabled = item.sms_enabled;
      if (item.in_app_enabled !== undefined) upsertData.in_app_enabled = item.in_app_enabled;

      const { data, error } = await supabase
        .from('notification_event_preferences')
        .upsert(upsertData, {
          onConflict: 'profile_id,event_type',
        })
        .select()
        .single();

      if (error) {
        results.push({ event_type: item.event_type, error: error.message });
      } else {
        results.push({ event_type: item.event_type, success: true, data });
      }
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error in PUT /api/notifications/event-preferences:', error);
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
