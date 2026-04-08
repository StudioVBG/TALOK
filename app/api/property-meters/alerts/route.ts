export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { NextRequest, NextResponse } from 'next/server';
import { PropertyMetersService } from '@/lib/services/meters';

/**
 * GET /api/property-meters/alerts?property_id=xxx&unacknowledged=true
 * List meter alerts for a property
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('property_id');
    if (!propertyId) return NextResponse.json({ error: 'property_id requis' }, { status: 400 });

    const serviceClient = getServiceClient();

    // Auth
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });

    const { data: property } = await serviceClient
      .from('properties')
      .select('owner_id')
      .eq('id', propertyId)
      .single();

    if (!property) return NextResponse.json({ error: 'Bien non trouvé' }, { status: 404 });

    if (profile.role !== 'admin' && property.owner_id !== profile.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const unacknowledgedOnly = searchParams.get('unacknowledged') === 'true';
    const metersService = new PropertyMetersService(serviceClient);
    const alerts = await metersService.getAlerts(propertyId, { unacknowledgedOnly });

    return NextResponse.json({ alerts });
  } catch (error: unknown) {
    console.error('[GET /api/property-meters/alerts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
