export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { NextRequest, NextResponse } from 'next/server';
import { PropertyMetersService } from '@/lib/services/meters';

/**
 * POST /api/property-meters/[id]/disconnect
 * Revoke OAuth consent and disconnect meter
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

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });

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

    const disconnected = await metersService.disconnect(meterId);
    return NextResponse.json({ meter: disconnected });
  } catch (error: unknown) {
    console.error('[POST /api/property-meters/[id]/disconnect] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
