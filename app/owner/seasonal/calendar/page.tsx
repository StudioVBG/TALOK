"use client";

import { useState, useMemo } from "react";
import { CalendarDays, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSeasonalListings,
  useSeasonalCalendar,
} from "@/features/seasonal/hooks/use-seasonal";
import { SeasonalCalendar } from "@/features/seasonal/components/SeasonalCalendar";
import { BlockDatesModal } from "@/features/seasonal/components/BlockDatesModal";
import { SyncStatusBadge } from "@/features/seasonal/components/SyncStatusBadge";
import type { CalendarDay } from "@/lib/types/seasonal";
import { SeasonalGate } from "../SeasonalGate";

export default function SeasonalCalendarPage() {
  const { data: listingsData, isLoading: listingsLoading } = useSeasonalListings();
  const listings = listingsData?.listings ?? [];

  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  // Auto-select first listing
  const listingId = selectedListingId || listings[0]?.id || "";

  const [calFrom, setCalFrom] = useState<string | undefined>();
  const [calTo, setCalTo] = useState<string | undefined>();

  const { data: calendarData, isLoading: calendarLoading } = useSeasonalCalendar(
    listingId,
    calFrom,
    calTo
  );

  const days = calendarData?.days ?? [];

  function handleDayClick(day: CalendarDay) {
    if (day.status === "available") {
      setSelectedDate(day.date);
      setBlockOpen(true);
    }
  }

  function handleMonthChange(year: number, month: number) {
    const from = new Date(year, month, 1);
    const to = new Date(year, month + 1, 0);
    setCalFrom(from.toISOString().split("T")[0]);
    setCalTo(to.toISOString().split("T")[0]);
  }

  return (
    <SeasonalGate>
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Calendrier
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualisez la disponibilité de vos annonces
          </p>
        </div>
        <div className="flex items-center gap-2">
          {listingId && <SyncStatusBadge listingId={listingId} />}
          <Button
            variant="outline"
            onClick={() => {
              setSelectedDate(undefined);
              setBlockOpen(true);
            }}
          >
            <Ban className="h-4 w-4 mr-2" />
            Bloquer des dates
          </Button>
        </div>
      </div>

      {/* Listing selector */}
      {listings.length > 1 && (
        <div className="max-w-xs">
          <Select value={listingId} onValueChange={setSelectedListingId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une annonce" />
            </SelectTrigger>
            <SelectContent>
              {listings.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Calendar */}
      {listingsLoading || calendarLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : !listingId ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mb-4" />
          <p>Créez une annonce pour afficher le calendrier</p>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl p-6">
          <SeasonalCalendar
            days={days}
            onDayClick={handleDayClick}
            onMonthChange={handleMonthChange}
          />
        </div>
      )}

      {/* Block dates modal */}
      {listingId && (
        <BlockDatesModal
          listingId={listingId}
          open={blockOpen}
          onOpenChange={setBlockOpen}
          initialStartDate={selectedDate}
        />
      )}
    </div>
    </SeasonalGate>
  );
}
