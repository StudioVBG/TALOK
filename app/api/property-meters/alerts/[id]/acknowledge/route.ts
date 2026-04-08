export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { NextRequest, NextResponse } from 'next/server';
import { PropertyMetersService } from '@/lib/services/meters';

/**
 * POST /api/property-meters/alerts/[id]/acknowledge
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: alertId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });

    // Verify alert exists and user has access
    const { data: alert } = await serviceClient
      .from('meter_alerts')
      .select('id, property_id')
      .eq('id', alertId)
      .maybeSingle();

    if (!alert) return NextResponse.json({ error: 'Alerte non trouvée' }, { status: 404 });

    const { data: property } = await serviceClient
      .from('properties')
      .select('owner_id')
      .eq('id', alert.property_id)
      .single();

    if (profile.role !== 'admin' && property?.owner_id !== profile.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const metersService = new PropertyMetersService(serviceClient);
    await metersService.acknowledgeAlert(alertId, profile.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[POST /api/property-meters/alerts/[id]/acknowledge] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
