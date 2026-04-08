/**
 * Enedis SGE (DataConnect) Integration Service
 *
 * Handles OAuth2 flow and daily consumption data retrieval.
 * API: https://ext.hml.api.enedis.fr/
 * Meter identifier: PDL (Point De Livraison) — 14 digits
 *
 * Data availability: J-1 data available at J+1
 */

import type { PropertyMeterReading } from './types';

const ENEDIS_BASE_URL = process.env.ENEDIS_API_URL || 'https://ext.hml.api.enedis.fr';
const ENEDIS_CLIENT_ID = process.env.ENEDIS_CLIENT_ID || '';
const ENEDIS_CLIENT_SECRET = process.env.ENEDIS_CLIENT_SECRET || '';
const ENEDIS_REDIRECT_URI = process.env.ENEDIS_REDIRECT_URI || '';

export interface EnedisTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface EnedisConsumptionPoint {
  date: string;
  value: number; // Wh
}

export interface EnedisConsumptionResponse {
  meter_reading: {
    usage_point_id: string;
    start: string;
    end: string;
    quality: string;
    reading_type: {
      measurement_kind: string;
      unit: string;
      aggregate: string;
    };
    interval_reading: Array<{
      value: string;
      date: string;
    }>;
  };
}

/**
 * Build the OAuth2 authorization URL for Enedis DataConnect
 */
export function getEnedisAuthUrl(pdl: string, state: string): string {
  const params = new URLSearchParams({
    client_id: ENEDIS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: ENEDIS_REDIRECT_URI,
    duration: 'P3Y', // 3-year consent
    state,
    usage_point_id: pdl,
  });
  return `https://mon-compte-particulier.enedis.fr/dataconnect/v1/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access/refresh tokens
 */
export async function exchangeEnedisCode(code: string): Promise<EnedisTokenResponse> {
  const response = await fetch(`${ENEDIS_BASE_URL}/oauth2/v3/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: ENEDIS_CLIENT_ID,
      client_secret: ENEDIS_CLIENT_SECRET,
      code,
      redirect_uri: ENEDIS_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Enedis token exchange failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token
 */
export async function refreshEnedisToken(refreshToken: string): Promise<EnedisTokenResponse> {
  const response = await fetch(`${ENEDIS_BASE_URL}/oauth2/v3/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ENEDIS_CLIENT_ID,
      client_secret: ENEDIS_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Enedis token refresh failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Fetch daily consumption data from Enedis
 */
export async function fetchEnedisDaily(
  accessToken: string,
  pdl: string,
  startDate: string,
  endDate: string
): Promise<Array<Pick<PropertyMeterReading, 'reading_date' | 'value' | 'unit' | 'source'>>> {
  const params = new URLSearchParams({
    start: startDate,
    end: endDate,
    usage_point_id: pdl,
  });

  const response = await fetch(
    `${ENEDIS_BASE_URL}/metering_data_dc/v5/daily_consumption?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Enedis daily consumption failed: ${response.status} - ${error}`);
  }

  const data: EnedisConsumptionResponse = await response.json();

  return data.meter_reading.interval_reading.map((point) => ({
    reading_date: point.date,
    value: parseInt(point.value, 10) / 1000, // Wh → kWh
    unit: 'kWh' as const,
    source: 'enedis' as const,
  }));
}

/**
 * Validate PDL format (14 digits)
 */
export function isValidPDL(pdl: string): boolean {
  return /^\d{14}$/.test(pdl);
}
