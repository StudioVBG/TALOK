export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getServiceClient } from '@/lib/supabase/service-client';
import { NextRequest, NextResponse } from 'next/server';
import { PropertyMetersService, exchangeGRDFCode, fetchGRDFConsumption } from '@/lib/services/meters';

/**
 * GET /api/oauth/grdf/callback?code=xxx&state=meterId:userId
 * Callback after GRDF OAuth consent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('[GRDF OAuth] Error from GRDF:', error);
      return NextResponse.redirect(new URL('/owner/properties?meter_error=consent_refused', request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/owner/properties?meter_error=invalid_callback', request.url));
    }

    const [meterId, userId] = state.split(':');
    if (!meterId || !userId) {
      return NextResponse.redirect(new URL('/owner/properties?meter_error=invalid_state', request.url));
    }

    const tokenResponse = await exchangeGRDFCode(code);

    const serviceClient = getServiceClient();
    const metersService = new PropertyMetersService(serviceClient);

    const meter = await metersService.getById(meterId);
    if (!meter) {
      return NextResponse.redirect(new URL('/owner/properties?meter_error=meter_not_found', request.url));
    }

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
    await metersService.markConnected(meterId, {
      oauth_token_encrypted: tokenResponse.access_token,
      oauth_refresh_token_encrypted: tokenResponse.refresh_token,
      oauth_expires_at: expiresAt,
      connection_consent_by: profile?.id || userId,
    });

    // Initial sync: fetch last 3 months
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const readings = await fetchGRDFConsumption(
        tokenResponse.access_token,
        meter.meter_reference,
        startDate,
        endDate
      );

      if (readings.length > 0) {
        await metersService.insertReadingsBatch(
          meterId,
          meter.property_id,
          readings.map((r) => ({
            reading_date: r.reading_date,
            value: r.value,
            unit: r.unit,
            source: r.source,
          }))
        );
      }
    } catch (syncError) {
      console.warn('[GRDF OAuth] Initial sync failed (non-blocking):', syncError);
    }

    return NextResponse.redirect(
      new URL(`/owner/properties/${meter.property_id}?tab=meters&connected=true`, request.url)
    );
  } catch (error: unknown) {
    console.error('[GET /api/oauth/grdf/callback] Error:', error);
    return NextResponse.redirect(new URL('/owner/properties?meter_error=connection_failed', request.url));
  }
}
