/**
 * iCal parser pour Airbnb / Booking.com
 * Parse un feed iCal et convertit en réservations Talok
 */

export interface ICalEvent {
  uid: string;
  summary: string;
  dtstart: string; // YYYY-MM-DD
  dtend: string;   // YYYY-MM-DD
  description?: string;
}

/**
 * Parse un texte iCal et retourne les événements VEVENT
 */
export function parseICalEvents(icalText: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = icalText.replace(/\r\n /g, "").split(/\r?\n/);

  let current: Partial<ICalEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (line === "END:VEVENT" && current) {
      if (current.uid && current.dtstart && current.dtend) {
        events.push({
          uid: current.uid,
          summary: current.summary || "Réservation",
          dtstart: current.dtstart,
          dtend: current.dtend,
          description: current.description,
        });
      }
      current = null;
      continue;
    }

    if (!current) continue;

    if (line.startsWith("UID:")) {
      current.uid = line.slice(4).trim();
    } else if (line.startsWith("SUMMARY:")) {
      current.summary = line.slice(8).trim();
    } else if (line.startsWith("DTSTART")) {
      current.dtstart = parseICalDate(line);
    } else if (line.startsWith("DTEND")) {
      current.dtend = parseICalDate(line);
    } else if (line.startsWith("DESCRIPTION:")) {
      current.description = line.slice(12).trim().replace(/\\n/g, "\n");
    }
  }

  return events;
}

/**
 * Parse une ligne date iCal (VALUE=DATE:20260415 ou DTSTART:20260415T150000Z)
 */
function parseICalDate(line: string): string {
  const parts = line.split(":");
  const value = parts[parts.length - 1].trim();

  // Format: 20260415 or 20260415T150000Z
  if (value.length >= 8) {
    const year = value.slice(0, 4);
    const month = value.slice(4, 6);
    const day = value.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  return value;
}

function daysBetween(from: string, to: string): number {
  const d1 = new Date(from);
  const d2 = new Date(to);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Convertit un événement iCal en données de réservation
 */
export function icalEventToReservation(
  event: ICalEvent,
  listingId: string,
  propertyId: string,
  source: "airbnb" | "booking"
): {
  listing_id: string;
  property_id: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  nights: number;
  nightly_rate_cents: number;
  source: string;
  external_id: string;
  status: string;
  guest_count: number;
  deposit_cents: number;
} | null {
  // Skip "Not available" or "Blocked" entries (used by Airbnb for blocked dates)
  const lowerSummary = event.summary.toLowerCase();
  if (lowerSummary.includes("not available") || lowerSummary.includes("blocked") || lowerSummary.includes("airbnb (not available)")) {
    return null;
  }

  const nights = daysBetween(event.dtstart, event.dtend);
  if (nights < 1) return null;

  // Extract guest name from summary
  let guestName = event.summary;
  if (source === "airbnb" && event.summary.includes(" - ")) {
    guestName = event.summary.split(" - ")[0].trim();
  }

  return {
    listing_id: listingId,
    property_id: propertyId,
    guest_name: guestName || "Voyageur",
    guest_email: `${source}@import.talok.fr`,
    check_in: event.dtstart,
    check_out: event.dtend,
    nights,
    nightly_rate_cents: 0, // Price not in iCal — owner fills later
    source,
    external_id: event.uid,
    status: "confirmed",
    guest_count: 1,
    deposit_cents: 0,
  };
}
