export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { NextRequest, NextResponse } from 'next/server';
import { PropertyMetersService } from '@/lib/services/meters';

/**
 * GET /api/property-meters/[id]/readings/chart?start_date=...&end_date=...
 * Returns chart-optimized consumption data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meterId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      .toISOString().split('T')[0];
    const startDate = searchParams.get('start_date') || defaultStart;
    const endDate = searchParams.get('end_date') || now.toISOString().split('T')[0];

    const serviceClient = getServiceClient();
    const metersService = new PropertyMetersService(serviceClient);

    const meter = await metersService.getById(meterId);
    if (!meter) return NextResponse.json({ error: 'Compteur non trouvé' }, { status: 404 });

    // Auth: check profile
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });

    if (profile.role !== 'admin') {
      const { data: property } = await serviceClient
        .from('properties')
        .select('owner_id')
        .eq('id', meter.property_id)
        .single();

      if (property?.owner_id !== profile.id) {
        const { data: signer } = await serviceClient
          .from('lease_signers')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (!signer) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }
    }

    const chartData = await metersService.getChartData(meterId, startDate, endDate);

    return NextResponse.json({ chart_data: chartData, start_date: startDate, end_date: endDate });
  } catch (error: unknown) {
    console.error('[GET /api/property-meters/[id]/readings/chart] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
