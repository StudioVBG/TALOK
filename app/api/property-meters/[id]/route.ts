export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PropertyMetersService } from '@/lib/services/meters';

const updateMeterSchema = z.object({
  meter_reference: z.string().min(1).max(50).optional(),
  meter_serial: z.string().max(50).optional(),
  contract_holder: z.string().max(100).optional(),
  contract_start_date: z.string().optional(),
  tariff_option: z.enum(['base', 'hc_hp', 'tempo']).optional(),
  subscribed_power_kva: z.number().int().positive().optional(),
  alert_threshold_daily: z.number().positive().nullable().optional(),
  alert_threshold_monthly: z.number().positive().nullable().optional(),
});

async function getProfileAndVerifyAccess(
  serviceClient: ReturnType<typeof getServiceClient>,
  userId: string,
  meterId: string
) {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) return { error: 'Profil non trouvé', status: 404 };

  const metersService = new PropertyMetersService(serviceClient);
  const meter = await metersService.getById(meterId);
  if (!meter) return { error: 'Compteur non trouvé', status: 404 };

  const { data: property } = await serviceClient
    .from('properties')
    .select('owner_id')
    .eq('id', meter.property_id)
    .single();

  const isAdmin = profile.role === 'admin';
  if (!isAdmin && property?.owner_id !== profile.id) {
    return { error: 'Accès non autorisé', status: 403 };
  }

  return { profile, meter, metersService };
}

/**
 * PATCH /api/property-meters/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meterId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const body = await request.json();
    const parsed = updateMeterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();
    const access = await getProfileAndVerifyAccess(serviceClient, user.id, meterId);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const updated = await access.metersService.update(meterId, parsed.data);
    return NextResponse.json({ meter: updated });
  } catch (error: unknown) {
    console.error('[PATCH /api/property-meters/[id]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/property-meters/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meterId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const serviceClient = getServiceClient();
    const access = await getProfileAndVerifyAccess(serviceClient, user.id, meterId);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    await access.metersService.delete(meterId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[DELETE /api/property-meters/[id]] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
