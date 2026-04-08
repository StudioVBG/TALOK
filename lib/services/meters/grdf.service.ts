/**
 * GRDF ADICT Integration Service
 *
 * Handles OAuth2 flow and monthly gas consumption data retrieval.
 * API: https://api.grdf.fr/
 * Meter identifier: PCE (Point de Comptage et d'Estimation) — 14 digits
 *
 * Data availability: M+1
 */

import type { PropertyMeterReading } from './types';

const GRDF_BASE_URL = process.env.GRDF_API_URL || 'https://api.grdf.fr';
const GRDF_CLIENT_ID = process.env.GRDF_CLIENT_ID || '';
const GRDF_CLIENT_SECRET = process.env.GRDF_CLIENT_SECRET || '';
const GRDF_REDIRECT_URI = process.env.GRDF_REDIRECT_URI || '';

export interface GRDFTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface GRDFConsumptionResponse {
  pce: string;
  periode: {
    date_debut: string;
    date_fin: string;
  };
  releves: Array<{
    date_releve: string;
    index_m3: number;
    volume_m3: number;
    energie_kwh: number;
    type_releve: string;
  }>;
}

/**
 * Build the OAuth2 authorization URL for GRDF ADICT
 */
export function getGRDFAuthUrl(pce: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GRDF_CLIENT_ID,
    response_type: 'code',
    redirect_uri: GRDF_REDIRECT_URI,
    scope: 'openid',
    state,
    pce,
  });
  return `https://souscription.grdf.fr/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access/refresh tokens
 */
export async function exchangeGRDFCode(code: string): Promise<GRDFTokenResponse> {
  const response = await fetch(`${GRDF_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: GRDF_CLIENT_ID,
      client_secret: GRDF_CLIENT_SECRET,
      code,
      redirect_uri: GRDF_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GRDF token exchange failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token
 */
export async function refreshGRDFToken(refreshToken: string): Promise<GRDFTokenResponse> {
  const response = await fetch(`${GRDF_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: GRDF_CLIENT_ID,
      client_secret: GRDF_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GRDF token refresh failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Fetch consumption data from GRDF
 */
export async function fetchGRDFConsumption(
  accessToken: string,
  pce: string,
  startDate: string,
  endDate: string
): Promise<Array<Pick<PropertyMeterReading, 'reading_date' | 'value' | 'unit' | 'source'>>> {
  const params = new URLSearchParams({
    pce,
    date_debut: startDate,
    date_fin: endDate,
  });

  const response = await fetch(
    `${GRDF_BASE_URL}/adict/v2/pce/${pce}/consommations?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GRDF consumption fetch failed: ${response.status} - ${error}`);
  }

  const data: GRDFConsumptionResponse = await response.json();

  return data.releves.map((releve) => ({
    reading_date: releve.date_releve,
    value: releve.volume_m3,
    unit: 'm3' as const,
    source: 'grdf' as const,
  }));
}

/**
 * Validate PCE format (14 digits)
 */
export function isValidPCE(pce: string): boolean {
  return /^\d{14}$/.test(pce);
}
