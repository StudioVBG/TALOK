"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarDays,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// Types
interface VisitSlot {
  id: string;
  property_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: "available" | "booked" | "blocked";
  max_visitors: number;
  current_visitors: number;
}

interface TimeSlotPickerProps {
  propertyId: string;
  onSlotSelect: (slot: VisitSlot) => void;
  selectedSlotId?: string;
  className?: string;
}

// API Function
async function fetchAvailableSlots(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{ slots: VisitSlot[]; slotsByDate: Record<string, VisitSlot[]> }> {
  const params = new URLSearchParams({
    property_id: propertyId,
    start_date: startDate,
    end_date: endDate,
  });

  const res = await fetch(`/api/visit-scheduling/slots?${params}`);
  if (!res.ok) throw new Error("Erreur lors du chargement des créneaux");
  return res.json();
}

export function TimeSlotPicker({
  propertyId,
  onSlotSelect,
  selectedSlotId,
  className,
}: TimeSlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [month, setMonth] = useState(new Date());

  // Calculate date range (30 days from today)
  const today = startOfDay(new Date());
  const startDate = format(today, "yyyy-MM-dd");
  const endDate = format(addDays(today, 30), "yyyy-MM-dd");

  // Query available slots
  const { data, isLoading, error } = useQuery({
    queryKey: ["visit-slots", propertyId, startDate, endDate],
    queryFn: () => fetchAvailableSlots(propertyId, startDate, endDate),
  });

  const slots = data?.slots || [];
  const slotsByDate = data?.slotsByDate || {};

  // Compute dates with available slots
  const datesWithSlots = useMemo(() => {
    const dates = new Set<string>();
    slots.forEach((slot) => {
      if (slot.status === "available") {
        dates.add(slot.slot_date);
      }
    });
    return dates;
  }, [slots]);

  // Get slots for selected date
  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return (slotsByDate[dateStr] || []).filter(
      (slot) => slot.status === "available"
    );
  }, [selectedDate, slotsByDate]);

  // Format time string (HH:mm:ss or HH:mm)
  const formatTime = (timeString: string) => {
    // Handle time strings like "10:00:00" or "10:00"
    return timeString.slice(0, 5);
  };

  // Check if a date has available slots
  const hasAvailableSlots = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return datesWithSlots.has(dateStr);
  };

  // Disable dates without slots or in the past
  const disabledDays = (date: Date) => {
    return date < today || !hasAvailableSlots(date);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarX className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Erreur de chargement</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Impossible de charger les créneaux disponibles
          </p>
        </CardContent>
      </Card>
    );
  }

  if (slots.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarX className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Aucun créneau disponible</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Le propriétaire n'a pas encore défini de créneaux de visite pour ce
            bien.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Réserver une visite
        </CardTitle>
        <CardDescription>
          Sélectionnez une date puis un créneau horaire
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Calendar */}
          <div className="rounded-lg border p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={month}
              onMonthChange={setMonth}
              locale={fr}
              disabled={disabledDays}
              modifiers={{
                available: (date) => hasAvailableSlots(date),
              }}
              modifiersClassNames={{
                available:
                  "bg-green-50 text-green-900 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-100",
              }}
              className="rounded-md"
              classNames={{
                months: "flex flex-col space-y-4",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell:
                  "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: cn(
                  "relative h-9 w-9 text-center text-sm p-0",
                  "focus-within:relative focus-within:z-20"
                ),
                day: cn(
                  "h-9 w-9 p-0 font-normal",
                  "inline-flex items-center justify-center rounded-md",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                ),
                day_selected:
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-30",
              }}
            />
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-sm bg-green-100 dark:bg-green-950/50" />
                <span>Disponible</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-sm bg-muted" />
                <span>Indisponible</span>
              </div>
            </div>
          </div>

          {/* Time Slots */}
          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {selectedDate
                ? format(selectedDate, "EEEE d MMMM", { locale: fr })
                : "Sélectionnez une date"}
            </h3>

            {!selectedDate ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <CalendarDays className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">
                  Cliquez sur une date verte pour voir les créneaux disponibles
                </p>
              </div>
            ) : slotsForSelectedDate.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">
                  Aucun créneau disponible pour cette date
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[280px] pr-4">
                <div className="grid grid-cols-2 gap-2">
                  {slotsForSelectedDate.map((slot) => {
                    const isSelected = slot.id === selectedSlotId;
                    const spotsLeft = slot.max_visitors - slot.current_visitors;

                    return (
                      <Button
                        key={slot.id}
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "h-auto flex-col py-3 transition-all",
                          isSelected && "ring-2 ring-primary ring-offset-2"
                        )}
                        onClick={() => onSlotSelect(slot)}
                      >
                        <span className="text-lg font-semibold">
                          {formatTime(slot.start_time)}
                        </span>
                        <span className="text-xs opacity-70">
                          {formatTime(slot.end_time)}
                        </span>
                        {slot.max_visitors > 1 && (
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className="mt-1 text-[10px]"
                          >
                            {spotsLeft} place{spotsLeft > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
