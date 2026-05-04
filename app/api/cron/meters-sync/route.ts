export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getServiceClient } from '@/lib/supabase/service-client';
import { NextRequest, NextResponse } from 'next/server';
import {
  PropertyMetersService,
  fetchEnedisDaily,
  refreshEnedisToken,
  fetchGRDFConsumption,
  refreshGRDFToken,
} from '@/lib/services/meters';
import { encrypt, decrypt, isEncrypted } from '@/lib/security/encryption.service';

const CRON_SECRET = process.env.CRON_SECRET || '';

// Délai minimum entre 2 sync d'un même compteur. Empêche un double-run
// (Netlify timeout/retry) de re-synchroniser les mêmes lectures.
const MIN_SYNC_INTERVAL_HOURS = 6;

/**
 * Renvoie le token en clair, qu'il soit déjà chiffré ou stocké en
 * clair (legacy avant le fix de chiffrement OAuth).
 */
function readToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  return isEncrypted(stored) ? decrypt(stored) : stored;
}

/**
 * POST /api/cron/meters-sync
 * Daily sync of connected meters (Enedis/GRDF)
 * Triggered daily at 6:00 AM via Netlify scheduled functions
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const metersService = new PropertyMetersService(serviceClient);
    const meters = await metersService.getActiveConnectedMeters();

    const results = { synced: 0, errors: 0, skipped: 0, throttled: 0 };
    const minIntervalMs = MIN_SYNC_INTERVAL_HOURS * 60 * 60 * 1000;
    const now = Date.now();

    for (const meter of meters) {
      try {
        if (!meter.oauth_token_encrypted || !meter.oauth_refresh_token_encrypted) {
          results.skipped++;
          continue;
        }

        // Idempotence : skip si on a sync ce compteur il y a moins de 6h.
        // Évite qu'un double-run du cron (Netlify timeout/retry) ne
        // re-synchronise les mêmes lectures.
        const lastSync = (meter as any).last_sync_at;
        if (lastSync && now - new Date(lastSync).getTime() < minIntervalMs) {
          results.throttled++;
          continue;
        }

        let accessToken = readToken(meter.oauth_token_encrypted);
        const refreshTokenPlain = readToken(meter.oauth_refresh_token_encrypted);

        if (!accessToken || !refreshTokenPlain) {
          results.skipped++;
          continue;
        }

        // Check if token needs refresh
        if (meter.oauth_expires_at && new Date(meter.oauth_expires_at) < new Date()) {
          try {
            if (meter.provider === 'enedis') {
              const refreshed = await refreshEnedisToken(refreshTokenPlain);
              accessToken = refreshed.access_token;
              const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
              await serviceClient
                .from('property_meters')
                .update({
                  oauth_token_encrypted: encrypt(refreshed.access_token),
                  oauth_refresh_token_encrypted: refreshed.refresh_token
                    ? encrypt(refreshed.refresh_token)
                    : null,
                  oauth_expires_at: expiresAt,
                })
                .eq('id', meter.id);
            } else if (meter.provider === 'grdf') {
              const refreshed = await refreshGRDFToken(refreshTokenPlain);
              accessToken = refreshed.access_token;
              const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
              await serviceClient
                .from('property_meters')
                .update({
                  oauth_token_encrypted: encrypt(refreshed.access_token),
                  oauth_refresh_token_encrypted: refreshed.refresh_token
                    ? encrypt(refreshed.refresh_token)
                    : null,
                  oauth_expires_at: expiresAt,
                })
                .eq('id', meter.id);
            }
          } catch (refreshError) {
            await metersService.updateSyncStatus(meter.id, 'expired', 'Token refresh failed');
            results.errors++;
            continue;
          }
        }

        if (!accessToken) {
          results.skipped++;
          continue;
        }

        // Fetch recent readings
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (meter.provider === 'enedis') {
          const readings = await fetchEnedisDaily(accessToken, meter.meter_reference, startDate, endDate);
          if (readings.length > 0) {
            await metersService.insertReadingsBatch(
              meter.id,
              meter.property_id,
              readings.map((r) => ({
                reading_date: r.reading_date,
                value: r.value,
                unit: r.unit,
                source: r.source,
              }))
            );
          }
        } else if (meter.provider === 'grdf') {
          const readings = await fetchGRDFConsumption(accessToken, meter.meter_reference, startDate, endDate);
          if (readings.length > 0) {
            await metersService.insertReadingsBatch(
              meter.id,
              meter.property_id,
              readings.map((r) => ({
                reading_date: r.reading_date,
                value: r.value,
                unit: r.unit,
                source: r.source,
              }))
            );
          }
        }

        await metersService.updateSyncStatus(meter.id, 'active');
        await metersService.checkAlertThresholds(meter);
        results.synced++;
      } catch (meterError: unknown) {
        const message = meterError instanceof Error ? meterError.message : 'Unknown error';
        console.error(`[meters-sync] Error syncing meter ${meter.id}:`, message);
        await metersService.updateSyncStatus(meter.id, 'error', message);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      total: meters.length,
      ...results,
    });
  } catch (error: unknown) {
    console.error('[POST /api/cron/meters-sync] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
