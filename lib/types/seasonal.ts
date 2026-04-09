// ============================================================
// Types — Module location saisonnière
// ============================================================

export interface SeasonalListing {
  id: string;
  property_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  min_nights: number;
  max_nights: number;
  max_guests: number;
  check_in_time: string;
  check_out_time: string;
  house_rules: string | null;
  amenities: string[];
  cleaning_fee_cents: number;
  security_deposit_cents: number;
  tourist_tax_per_night_cents: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  property?: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    cover_url: string | null;
  };
}

export type SeasonName = 'haute' | 'basse' | 'moyenne' | 'fetes';

export interface SeasonalRate {
  id: string;
  listing_id: string;
  season_name: SeasonName;
  start_date: string;
  end_date: string;
  nightly_rate_cents: number;
  weekly_rate_cents: number | null;
  monthly_rate_cents: number | null;
  min_nights_override: number | null;
  created_at: string;
}

export type ReservationSource = 'direct' | 'airbnb' | 'booking' | 'other';

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type CleaningStatus = 'pending' | 'scheduled' | 'done';

export interface Reservation {
  id: string;
  listing_id: string;
  property_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_count: number;
  check_in: string;
  check_out: string;
  nights: number;
  nightly_rate_cents: number;
  subtotal_cents: number;
  cleaning_fee_cents: number;
  tourist_tax_cents: number;
  total_cents: number;
  deposit_cents: number;
  source: ReservationSource;
  external_id: string | null;
  status: ReservationStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  cleaning_status: CleaningStatus;
  cleaning_provider_id: string | null;
  notes: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  listing?: SeasonalListing;
  property?: {
    id: string;
    adresse_complete: string;
    ville: string;
    cover_url: string | null;
  };
}

export interface SeasonalBlockedDate {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  created_at: string;
}

export interface CalendarDay {
  date: string;
  status: 'available' | 'reserved' | 'blocked' | 'checked_in' | 'past';
  reservation_id?: string;
  reservation?: Pick<Reservation, 'id' | 'guest_name' | 'source' | 'status'>;
}

export interface SeasonalStats {
  total_listings: number;
  active_reservations: number;
  pending_checkins: number;
  pending_cleaning: number;
  revenue_this_month_cents: number;
  occupancy_rate: number;
}
