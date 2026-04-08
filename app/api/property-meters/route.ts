export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PropertyMetersService } from '@/lib/services/meters';
import { withFeatureAccess } from '@/lib/middleware/subscription-check';

const createMeterSchema = z.object({
  property_id: z.string().uuid(),
  meter_type: z.enum(['electricity', 'gas', 'water', 'heating', 'other']),
  provider: z.enum(['enedis', 'grdf', 'veolia', 'manual']).optional(),
  meter_reference: z.string().min(1).max(50),
  meter_serial: z.string().max(50).optional(),
  contract_holder: z.string().max(100).optional(),
  contract_start_date: z.string().optional(),
  tariff_option: z.enum(['base', 'hc_hp', 'tempo']).optional(),
  subscribed_power_kva: z.number().int().positive().optional(),
  alert_threshold_daily: z.number().positive().optional(),
  alert_threshold_monthly: z.number().positive().optional(),
});

/**
 * GET /api/property-meters?property_id=xxx
 * List all connected meters for a property
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('property_id');
    if (!propertyId) {
      return NextResponse.json({ error: 'property_id requis' }, { status: 400 });
    }

    const serviceClient = getServiceClient();

    // Verify ownership
    const { data: property } = await serviceClient
      .from('properties')
      .select('id, owner_id')
      .eq('id', propertyId)
      .single();

    if (!property) {
      return NextResponse.json({ error: 'Bien non trouvé' }, { status: 404 });
    }

    // Check profile
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';
    if (!isAdmin && property.owner_id !== profile?.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const metersService = new PropertyMetersService(serviceClient);
    const meters = await metersService.listByProperty(propertyId);

    return NextResponse.json({ meters });
  } catch (error: unknown) {
    console.error('[GET /api/property-meters] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/property-meters
 * Create a new connected meter
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createMeterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    // Get profile and verify ownership
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    const { data: property } = await serviceClient
      .from('properties')
      .select('id, owner_id')
      .eq('id', parsed.data.property_id)
      .single();

    if (!property) {
      return NextResponse.json({ error: 'Bien non trouvé' }, { status: 404 });
    }

    const isAdmin = profile.role === 'admin';
    if (!isAdmin && property.owner_id !== profile.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const metersService = new PropertyMetersService(serviceClient);
    const meter = await metersService.create(parsed.data);

    return NextResponse.json({ meter }, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/property-meters] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
