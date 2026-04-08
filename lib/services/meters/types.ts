/**
 * Types pour le module compteurs connectés
 */

export type MeterType = 'electricity' | 'gas' | 'water' | 'heating' | 'other';
export type MeterProvider = 'enedis' | 'grdf' | 'veolia' | 'manual';
export type SyncStatus = 'pending' | 'active' | 'error' | 'expired';
export type ReadingSource = 'manual' | 'enedis' | 'grdf' | 'veolia' | 'import';
export type ReadingUnit = 'kWh' | 'm3' | 'litres';
export type AlertType = 'overconsumption' | 'no_reading' | 'anomaly' | 'contract_expiry';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type TariffOption = 'base' | 'hc_hp' | 'tempo';

export interface PropertyMeter {
  id: string;
  property_id: string;
  meter_type: MeterType;
  provider: MeterProvider | null;
  meter_reference: string;
  meter_serial: string | null;
  is_connected: boolean;
  connection_consent_at: string | null;
  connection_consent_by: string | null;
  oauth_token_encrypted: string | null;
  oauth_refresh_token_encrypted: string | null;
  oauth_expires_at: string | null;
  last_sync_at: string | null;
  sync_status: SyncStatus;
  sync_error_message: string | null;
  contract_holder: string | null;
  contract_start_date: string | null;
  tariff_option: TariffOption | null;
  subscribed_power_kva: number | null;
  alert_threshold_daily: number | null;
  alert_threshold_monthly: number | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyMeterReading {
  id: string;
  meter_id: string;
  property_id: string;
  reading_date: string;
  value: number;
  unit: ReadingUnit;
  source: ReadingSource;
  recorded_by: string | null;
  photo_document_id: string | null;
  estimated_cost_cents: number | null;
  external_id: string | null;
  created_at: string;
}

export interface MeterAlert {
  id: string;
  meter_id: string;
  property_id: string;
  alert_type: AlertType;
  message: string;
  severity: AlertSeverity;
  data: Record<string, unknown>;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
}

// --- API request/response types ---

export interface CreateMeterInput {
  property_id: string;
  meter_type: MeterType;
  provider?: MeterProvider;
  meter_reference: string;
  meter_serial?: string;
  contract_holder?: string;
  contract_start_date?: string;
  tariff_option?: TariffOption;
  subscribed_power_kva?: number;
  alert_threshold_daily?: number;
  alert_threshold_monthly?: number;
}

export interface UpdateMeterInput {
  meter_reference?: string;
  meter_serial?: string;
  contract_holder?: string;
  contract_start_date?: string;
  tariff_option?: TariffOption;
  subscribed_power_kva?: number;
  alert_threshold_daily?: number;
  alert_threshold_monthly?: number;
}

export interface CreateReadingInput {
  reading_date: string;
  value: number;
  unit?: ReadingUnit;
  photo_document_id?: string;
  estimated_cost_cents?: number;
}

export interface MeterWithLastReading extends PropertyMeter {
  last_reading?: {
    value: number;
    date: string;
    unit: ReadingUnit;
  } | null;
  active_alerts_count?: number;
}

export interface ConsumptionChartData {
  date: string;
  value: number;
  unit: ReadingUnit;
  source: ReadingSource;
  estimated_cost_cents?: number | null;
}
