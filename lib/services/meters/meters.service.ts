/**
 * Property Meters Service (connected meters)
 *
 * Server-side service for managing connected meters (property_meters),
 * their readings, and alerts. Uses service client to bypass RLS.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  PropertyMeter,
  PropertyMeterReading,
  MeterAlert,
  CreateMeterInput,
  UpdateMeterInput,
  CreateReadingInput,
  MeterWithLastReading,
  ConsumptionChartData,
} from './types';

export class PropertyMetersService {
  constructor(private client: SupabaseClient) {}

  // ─── METERS CRUD ──────────────────────────────────

  async listByProperty(propertyId: string): Promise<MeterWithLastReading[]> {
    const { data: meters, error } = await this.client
      .from('property_meters')
      .select('*')
      .eq('property_id', propertyId)
      .order('meter_type', { ascending: true });

    if (error) throw error;
    if (!meters || meters.length === 0) return [];

    // Fetch last reading for each meter
    const results: MeterWithLastReading[] = await Promise.all(
      meters.map(async (meter) => {
        const { data: lastReading } = await this.client
          .from('property_meter_readings')
          .select('value, reading_date, unit')
          .eq('meter_id', meter.id)
          .order('reading_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count: alertCount } = await this.client
          .from('meter_alerts')
          .select('*', { count: 'exact', head: true })
          .eq('meter_id', meter.id)
          .is('acknowledged_at', null);

        return {
          ...meter,
          last_reading: lastReading
            ? { value: lastReading.value, date: lastReading.reading_date, unit: lastReading.unit }
            : null,
          active_alerts_count: alertCount || 0,
        } as MeterWithLastReading;
      })
    );

    return results;
  }

  async getById(meterId: string): Promise<PropertyMeter | null> {
    const { data, error } = await this.client
      .from('property_meters')
      .select('*')
      .eq('id', meterId)
      .maybeSingle();

    if (error) throw error;
    return data as PropertyMeter | null;
  }

  async create(input: CreateMeterInput): Promise<PropertyMeter> {
    const { data, error } = await this.client
      .from('property_meters')
      .insert({
        property_id: input.property_id,
        meter_type: input.meter_type,
        provider: input.provider || 'manual',
        meter_reference: input.meter_reference,
        meter_serial: input.meter_serial || null,
        contract_holder: input.contract_holder || null,
        contract_start_date: input.contract_start_date || null,
        tariff_option: input.tariff_option || null,
        subscribed_power_kva: input.subscribed_power_kva || null,
        alert_threshold_daily: input.alert_threshold_daily || null,
        alert_threshold_monthly: input.alert_threshold_monthly || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as PropertyMeter;
  }

  async update(meterId: string, input: UpdateMeterInput): Promise<PropertyMeter> {
    const updateData: Record<string, unknown> = {};
    if (input.meter_reference !== undefined) updateData.meter_reference = input.meter_reference;
    if (input.meter_serial !== undefined) updateData.meter_serial = input.meter_serial;
    if (input.contract_holder !== undefined) updateData.contract_holder = input.contract_holder;
    if (input.contract_start_date !== undefined) updateData.contract_start_date = input.contract_start_date;
    if (input.tariff_option !== undefined) updateData.tariff_option = input.tariff_option;
    if (input.subscribed_power_kva !== undefined) updateData.subscribed_power_kva = input.subscribed_power_kva;
    if (input.alert_threshold_daily !== undefined) updateData.alert_threshold_daily = input.alert_threshold_daily;
    if (input.alert_threshold_monthly !== undefined) updateData.alert_threshold_monthly = input.alert_threshold_monthly;

    const { data, error } = await this.client
      .from('property_meters')
      .update(updateData)
      .eq('id', meterId)
      .select()
      .single();

    if (error) throw error;
    return data as PropertyMeter;
  }

  async delete(meterId: string): Promise<void> {
    const { error } = await this.client
      .from('property_meters')
      .delete()
      .eq('id', meterId);

    if (error) throw error;
  }

  // ─── CONNECTION (OAuth) ───────────────────────────

  async markConnected(
    meterId: string,
    tokenData: {
      oauth_token_encrypted: string;
      oauth_refresh_token_encrypted: string | null;
      oauth_expires_at: string;
      connection_consent_by: string;
    }
  ): Promise<PropertyMeter> {
    const { data, error } = await this.client
      .from('property_meters')
      .update({
        is_connected: true,
        sync_status: 'active',
        connection_consent_at: new Date().toISOString(),
        connection_consent_by: tokenData.connection_consent_by,
        oauth_token_encrypted: tokenData.oauth_token_encrypted,
        oauth_refresh_token_encrypted: tokenData.oauth_refresh_token_encrypted,
        oauth_expires_at: tokenData.oauth_expires_at,
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', meterId)
      .select()
      .single();

    if (error) throw error;
    return data as PropertyMeter;
  }

  async disconnect(meterId: string): Promise<PropertyMeter> {
    const { data, error } = await this.client
      .from('property_meters')
      .update({
        is_connected: false,
        sync_status: 'pending',
        oauth_token_encrypted: null,
        oauth_refresh_token_encrypted: null,
        oauth_expires_at: null,
        sync_error_message: null,
      })
      .eq('id', meterId)
      .select()
      .single();

    if (error) throw error;
    return data as PropertyMeter;
  }

  async updateSyncStatus(
    meterId: string,
    status: 'active' | 'error' | 'expired',
    errorMessage?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      sync_status: status,
      sync_error_message: errorMessage || null,
    };
    if (status === 'active') {
      updateData.last_sync_at = new Date().toISOString();
    }

    const { error } = await this.client
      .from('property_meters')
      .update(updateData)
      .eq('id', meterId);

    if (error) throw error;
  }

  async getActiveConnectedMeters(): Promise<PropertyMeter[]> {
    const { data, error } = await this.client
      .from('property_meters')
      .select('*')
      .eq('is_connected', true)
      .eq('sync_status', 'active');

    if (error) throw error;
    return (data || []) as PropertyMeter[];
  }

  // ─── READINGS ─────────────────────────────────────

  async getReadings(
    meterId: string,
    options?: { limit?: number; startDate?: string; endDate?: string }
  ): Promise<PropertyMeterReading[]> {
    let query = this.client
      .from('property_meter_readings')
      .select('*')
      .eq('meter_id', meterId)
      .order('reading_date', { ascending: false })
      .limit(options?.limit || 50);

    if (options?.startDate) {
      query = query.gte('reading_date', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('reading_date', options.endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as PropertyMeterReading[];
  }

  async getChartData(
    meterId: string,
    startDate: string,
    endDate: string
  ): Promise<ConsumptionChartData[]> {
    const { data, error } = await this.client
      .from('property_meter_readings')
      .select('reading_date, value, unit, source, estimated_cost_cents')
      .eq('meter_id', meterId)
      .gte('reading_date', startDate)
      .lte('reading_date', endDate)
      .order('reading_date', { ascending: true });

    if (error) throw error;
    return (data || []).map((r) => ({
      date: r.reading_date,
      value: r.value,
      unit: r.unit,
      source: r.source,
      estimated_cost_cents: r.estimated_cost_cents,
    })) as ConsumptionChartData[];
  }

  async addReading(
    meterId: string,
    propertyId: string,
    input: CreateReadingInput,
    source: 'manual' | 'enedis' | 'grdf' | 'veolia' | 'import' = 'manual',
    recordedBy?: string,
    externalId?: string
  ): Promise<PropertyMeterReading> {
    const meter = await this.getById(meterId);
    if (!meter) throw new Error('Compteur non trouvé');

    const unit = input.unit || (meter.meter_type === 'electricity' ? 'kWh' : 'm3');

    const { data, error } = await this.client
      .from('property_meter_readings')
      .insert({
        meter_id: meterId,
        property_id: propertyId,
        reading_date: input.reading_date,
        value: input.value,
        unit,
        source,
        recorded_by: recordedBy || null,
        photo_document_id: input.photo_document_id || null,
        estimated_cost_cents: input.estimated_cost_cents || null,
        external_id: externalId || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as PropertyMeterReading;
  }

  async insertReadingsBatch(
    meterId: string,
    propertyId: string,
    readings: Array<{ reading_date: string; value: number; unit: string; source: string; external_id?: string }>
  ): Promise<number> {
    const rows = readings.map((r) => ({
      meter_id: meterId,
      property_id: propertyId,
      reading_date: r.reading_date,
      value: r.value,
      unit: r.unit,
      source: r.source,
      external_id: r.external_id || null,
    }));

    const { data, error } = await this.client
      .from('property_meter_readings')
      .upsert(rows, { onConflict: 'meter_id,reading_date,source', ignoreDuplicates: true })
      .select('id');

    if (error) throw error;
    return data?.length || 0;
  }

  // ─── ALERTS ───────────────────────────────────────

  async getAlerts(
    propertyId: string,
    options?: { unacknowledgedOnly?: boolean; meterId?: string }
  ): Promise<MeterAlert[]> {
    let query = this.client
      .from('meter_alerts')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (options?.unacknowledgedOnly) {
      query = query.is('acknowledged_at', null);
    }
    if (options?.meterId) {
      query = query.eq('meter_id', options.meterId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as MeterAlert[];
  }

  async createAlert(alert: Omit<MeterAlert, 'id' | 'created_at' | 'acknowledged_at' | 'acknowledged_by'>): Promise<MeterAlert> {
    const { data, error } = await this.client
      .from('meter_alerts')
      .insert(alert)
      .select()
      .single();

    if (error) throw error;
    return data as MeterAlert;
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('meter_alerts')
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', alertId);

    if (error) throw error;
  }

  // ─── ALERT THRESHOLDS CHECK ───────────────────────

  async checkAlertThresholds(meter: PropertyMeter): Promise<void> {
    // Daily threshold
    if (meter.alert_threshold_daily) {
      const today = new Date().toISOString().split('T')[0];
      const { data: todayReading } = await this.client
        .from('property_meter_readings')
        .select('value')
        .eq('meter_id', meter.id)
        .eq('reading_date', today)
        .maybeSingle();

      if (todayReading && todayReading.value > meter.alert_threshold_daily) {
        await this.createAlert({
          meter_id: meter.id,
          property_id: meter.property_id,
          alert_type: 'overconsumption',
          message: `Surconsommation détectée : ${todayReading.value} ${meter.meter_type === 'electricity' ? 'kWh' : 'm³'} (seuil : ${meter.alert_threshold_daily})`,
          severity: 'warning',
          data: { value: todayReading.value, threshold: meter.alert_threshold_daily },
        });
      }
    }

    // Monthly threshold
    if (meter.alert_threshold_monthly) {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const { data: monthReadings } = await this.client
        .from('property_meter_readings')
        .select('value')
        .eq('meter_id', meter.id)
        .gte('reading_date', monthStart);

      const monthTotal = (monthReadings || []).reduce((sum, r) => sum + Number(r.value), 0);
      if (monthTotal > meter.alert_threshold_monthly) {
        await this.createAlert({
          meter_id: meter.id,
          property_id: meter.property_id,
          alert_type: 'overconsumption',
          message: `Surconsommation mensuelle : ${monthTotal.toFixed(1)} (seuil : ${meter.alert_threshold_monthly})`,
          severity: 'critical',
          data: { total: monthTotal, threshold: meter.alert_threshold_monthly },
        });
      }
    }
  }
}
