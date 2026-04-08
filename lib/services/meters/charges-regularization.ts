/**
 * Charges Regularization for Connected Meters
 *
 * At annual charge closure:
 * - Sum actual consumption from meter readings
 * - Compare against provisions paid by tenant
 * - Generate accounting entry for complement or refund
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { MeterType } from './types';

// Average tariffs for cost estimation (cents per unit)
const DEFAULT_TARIFFS: Record<MeterType, number> = {
  electricity: 25, // ~0.25 EUR/kWh
  gas: 12,         // ~0.12 EUR/kWh (converted from m3)
  water: 400,      // ~4.00 EUR/m3
  heating: 10,     // ~0.10 EUR/kWh
  other: 0,
};

export interface RegularizationResult {
  meter_id: string;
  meter_type: MeterType;
  total_consumption: number;
  unit: string;
  estimated_cost_cents: number;
  provisions_paid_cents: number;
  regularization_cents: number; // > 0 = tenant owes, < 0 = refund
}

export async function calculateChargesRegularization(
  client: SupabaseClient,
  leaseId: string,
  year: number
): Promise<RegularizationResult[]> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Get the property from the lease
  const { data: lease } = await client
    .from('leases')
    .select('property_id')
    .eq('id', leaseId)
    .single();

  if (!lease?.property_id) return [];

  // Get property meters
  const { data: meters } = await client
    .from('property_meters')
    .select('*')
    .eq('property_id', lease.property_id);

  if (!meters || meters.length === 0) return [];

  const results: RegularizationResult[] = [];

  for (const meter of meters) {
    // Get readings for the year
    const { data: readings } = await client
      .from('property_meter_readings')
      .select('value, unit')
      .eq('meter_id', meter.id)
      .gte('reading_date', startDate)
      .lte('reading_date', endDate);

    if (!readings || readings.length === 0) continue;

    const totalConsumption = readings.reduce((sum, r) => sum + Number(r.value), 0);
    const unit = readings[0]?.unit || 'kWh';
    const tariffCents = DEFAULT_TARIFFS[meter.meter_type as MeterType] || 0;
    const estimatedCostCents = Math.round(totalConsumption * tariffCents);

    // Get provisions paid for this meter type during the year
    const { data: provisions } = await client
      .from('invoices')
      .select('amount')
      .eq('lease_id', leaseId)
      .eq('type', 'charges')
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .eq('status', 'paid');

    const provisionsPaidCents = (provisions || []).reduce(
      (sum, p) => sum + Math.round(Number(p.amount) * 100),
      0
    );

    // Calculate regularization
    // Proportional allocation: provisions cover all meter types
    // For simplicity, divide equally among meters
    const proportionalProvisions = Math.round(provisionsPaidCents / meters.length);

    const regularizationCents = estimatedCostCents - proportionalProvisions;

    results.push({
      meter_id: meter.id,
      meter_type: meter.meter_type as MeterType,
      total_consumption: totalConsumption,
      unit,
      estimated_cost_cents: estimatedCostCents,
      provisions_paid_cents: proportionalProvisions,
      regularization_cents: regularizationCents,
    });
  }

  return results;
}
