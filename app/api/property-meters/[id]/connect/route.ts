export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { NextRequest, NextResponse } from 'next/server';
import { PropertyMetersService, getEnedisAuthUrl, getGRDFAuthUrl, isValidPDL, isValidPCE } from '@/lib/services/meters';
import { withFeatureAccess } from '@/lib/middleware/subscription-check';

/**
 * POST /api/property-meters/[id]/connect
 * Initiate OAuth connection for Enedis/GRDF
 * Returns the authorization URL to redirect the user
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meterId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const serviceClient = getServiceClient();

    // Get profile
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });

    // Feature gate: connected_meters requires Pro+
    const featureCheck = await withFeatureAccess(profile.id, 'connected_meters');
    if (!featureCheck.allowed) {
      return NextResponse.json(
        { error: featureCheck.message || 'Fonctionnalité réservée au forfait Pro+' },
        { status: 403 }
      );
    }

    const metersService = new PropertyMetersService(serviceClient);
    const meter = await metersService.getById(meterId);
    if (!meter) return NextResponse.json({ error: 'Compteur non trouvé' }, { status: 404 });

    // Verify ownership
    const { data: property } = await serviceClient
      .from('properties')
      .select('owner_id')
      .eq('id', meter.property_id)
      .single();

    if (profile.role !== 'admin' && property?.owner_id !== profile.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Build OAuth URL based on provider
    const state = `${meterId}:${user.id}`;

    if (meter.meter_type === 'electricity') {
      if (!isValidPDL(meter.meter_reference)) {
        return NextResponse.json(
          { error: 'Le PDL doit contenir exactement 14 chiffres' },
          { status: 400 }
        );
      }
      const authUrl = getEnedisAuthUrl(meter.meter_reference, state);
      return NextResponse.json({ auth_url: authUrl, provider: 'enedis' });
    }

    if (meter.meter_type === 'gas') {
      if (!isValidPCE(meter.meter_reference)) {
        return NextResponse.json(
          { error: 'Le PCE doit contenir exactement 14 chiffres' },
          { status: 400 }
        );
      }
      const authUrl = getGRDFAuthUrl(meter.meter_reference, state);
      return NextResponse.json({ auth_url: authUrl, provider: 'grdf' });
    }

    // Water: not supported for connected meters in V1
    return NextResponse.json(
      { error: 'La connexion automatique n\'est pas disponible pour ce type de compteur. Utilisez le relevé manuel.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('[POST /api/property-meters/[id]/connect] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
