export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PropertyMetersService } from '@/lib/services/meters';

const addReadingSchema = z.object({
  reading_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().nonnegative(),
  unit: z.enum(['kWh', 'm3', 'litres']).optional(),
  photo_document_id: z.string().uuid().optional(),
  estimated_cost_cents: z.number().int().nonnegative().optional(),
});

/**
 * GET /api/property-meters/[id]/readings
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

    const serviceClient = getServiceClient();
    const metersService = new PropertyMetersService(serviceClient);

    const meter = await metersService.getById(meterId);
    if (!meter) return NextResponse.json({ error: 'Compteur non trouvé' }, { status: 404 });

    // Auth check
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });

    const isAdmin = profile.role === 'admin';
    if (!isAdmin) {
      const { data: property } = await serviceClient
        .from('properties')
        .select('owner_id')
        .eq('id', meter.property_id)
        .single();

      const isOwner = property?.owner_id === profile.id;
      if (!isOwner) {
        // Check if tenant
        const { data: signer } = await serviceClient
          .from('lease_signers')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (!signer) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const startDate = searchParams.get('start_date') || undefined;
    const endDate = searchParams.get('end_date') || undefined;

    const readings = await metersService.getReadings(meterId, {
      limit: Math.min(limit, 365),
      startDate,
      endDate,
    });

    return NextResponse.json({ readings, count: readings.length });
  } catch (error: unknown) {
    console.error('[GET /api/property-meters/[id]/readings] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/property-meters/[id]/readings
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meterId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const body = await request.json();
    const parsed = addReadingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();
    const metersService = new PropertyMetersService(serviceClient);

    const meter = await metersService.getById(meterId);
    if (!meter) return NextResponse.json({ error: 'Compteur non trouvé' }, { status: 404 });

    // Auth check
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });

    const isAdmin = profile.role === 'admin';
    if (!isAdmin) {
      const { data: property } = await serviceClient
        .from('properties')
        .select('owner_id')
        .eq('id', meter.property_id)
        .single();

      const isOwner = property?.owner_id === profile.id;
      if (!isOwner) {
        const { data: signer } = await serviceClient
          .from('lease_signers')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (!signer) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }
    }

    const reading = await metersService.addReading(
      meterId,
      meter.property_id,
      parsed.data,
      'manual',
      profile.id
    );

    return NextResponse.json({ reading }, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/property-meters/[id]/readings] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
