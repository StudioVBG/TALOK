"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  SeasonalListing,
  SeasonalRate,
  Reservation,
  CalendarDay,
  SeasonalStats,
} from "@/lib/types/seasonal";

// ============================================================
// Listings
// ============================================================

export function useSeasonalListings() {
  return useQuery<{ listings: SeasonalListing[] }>({
    queryKey: ["seasonal-listings"],
    queryFn: async () => {
      const res = await fetch("/api/seasonal/listings");
      if (!res.ok) throw new Error("Erreur chargement annonces");
      return res.json();
    },
  });
}

export function useSeasonalListing(id: string) {
  return useQuery<{ listing: SeasonalListing }>({
    queryKey: ["seasonal-listing", id],
    queryFn: async () => {
      const res = await fetch(`/api/seasonal/listings/${id}`);
      if (!res.ok) throw new Error("Erreur chargement annonce");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/seasonal/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur création annonce");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seasonal-listings"] }),
  });
}

export function useUpdateListing(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/seasonal/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur mise à jour");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seasonal-listings"] });
      qc.invalidateQueries({ queryKey: ["seasonal-listing", id] });
    },
  });
}

export function useDeleteListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/seasonal/listings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur suppression");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seasonal-listings"] }),
  });
}

// ============================================================
// Rates
// ============================================================

export function useSeasonalRates(listingId: string) {
  return useQuery<{ rates: SeasonalRate[] }>({
    queryKey: ["seasonal-rates", listingId],
    queryFn: async () => {
      const res = await fetch(`/api/seasonal/listings/${listingId}/rates`);
      if (!res.ok) throw new Error("Erreur chargement tarifs");
      return res.json();
    },
    enabled: !!listingId,
  });
}

export function useCreateRate(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/seasonal/listings/${listingId}/rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur création tarif");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seasonal-rates", listingId] }),
  });
}

// ============================================================
// Calendar
// ============================================================

export function useSeasonalCalendar(listingId: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return useQuery<{ days: CalendarDay[] }>({
    queryKey: ["seasonal-calendar", listingId, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/seasonal/listings/${listingId}/calendar?${params}`);
      if (!res.ok) throw new Error("Erreur chargement calendrier");
      return res.json();
    },
    enabled: !!listingId,
  });
}

export function useBlockDates(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { start_date: string; end_date: string; reason?: string }) => {
      const res = await fetch(`/api/seasonal/listings/${listingId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur blocage dates");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seasonal-calendar", listingId] }),
  });
}

// ============================================================
// Reservations
// ============================================================

export function useReservations(filters?: { status?: string; listing_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.listing_id) params.set("listing_id", filters.listing_id);

  return useQuery<{ reservations: Reservation[] }>({
    queryKey: ["reservations", filters],
    queryFn: async () => {
      const res = await fetch(`/api/reservations?${params}`);
      if (!res.ok) throw new Error("Erreur chargement réservations");
      return res.json();
    },
  });
}

export function useReservation(id: string) {
  return useQuery<{ reservation: Reservation }>({
    queryKey: ["reservation", id],
    queryFn: async () => {
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) throw new Error("Erreur chargement réservation");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur création réservation");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

export function useReservationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "check-in" | "check-out" | "cancel" }) => {
      const res = await fetch(`/api/reservations/${id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Erreur ${action}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["seasonal-calendar"] });
    },
  });
}

// ============================================================
// Sync
// ============================================================

export function useSyncIcal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listing_id, ical_url, platform }: { listing_id: string; ical_url: string; platform: "airbnb" | "booking" }) => {
      const res = await fetch(`/api/seasonal/sync/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id, ical_url }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur synchronisation");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["seasonal-calendar"] });
    },
  });
}
