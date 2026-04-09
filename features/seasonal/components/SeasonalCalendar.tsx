"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarDay } from "@/lib/types/seasonal";

interface SeasonalCalendarProps {
  days: CalendarDay[];
  onDayClick?: (day: CalendarDay) => void;
  onMonthChange?: (year: number, month: number) => void;
}

const STATUS_COLORS: Record<CalendarDay["status"], string> = {
  available: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  reserved: "bg-blue-100 text-blue-800 border-blue-300",
  blocked: "bg-gray-200 text-gray-500 border-gray-300",
  checked_in: "bg-amber-100 text-amber-800 border-amber-300",
  past: "bg-muted text-muted-foreground/50 border-transparent",
};

const STATUS_LABELS: Record<CalendarDay["status"], string> = {
  available: "Disponible",
  reserved: "Réservé",
  blocked: "Bloqué",
  checked_in: "En cours",
  past: "Passé",
};

const DAYS_OF_WEEK = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function SeasonalCalendar({ days, onDayClick, onMonthChange }: SeasonalCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday = 0, Sunday = 6
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const daysMap = new Map<string, CalendarDay>();
    for (const d of days) {
      daysMap.set(d.date, d);
    }

    const grid: (CalendarDay & { dayNum: number } | null)[] = [];

    // Fill offset
    for (let i = 0; i < startOffset; i++) {
      grid.push(null);
    }

    // Fill month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const calDay = daysMap.get(dateStr);
      grid.push({
        date: dateStr,
        status: calDay?.status ?? "available",
        reservation_id: calDay?.reservation_id,
        reservation: calDay?.reservation,
        dayNum: d,
      });
    }

    return grid;
  }, [days, year, month]);

  function navigate(delta: number) {
    const next = new Date(year, month + delta, 1);
    setCurrentDate(next);
    onMonthChange?.(next.getFullYear(), next.getMonth());
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {MONTHS_FR[month]} {year}
        </h3>
        <Button variant="outline" size="icon" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(["available", "reserved", "checked_in", "blocked"] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn("w-3 h-3 rounded-sm border", STATUS_COLORS[s])} />
            <span className="text-muted-foreground">{STATUS_LABELS[s]}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}

        {calendarGrid.map((cell, i) => {
          if (!cell) {
            return <div key={`empty-${i}`} />;
          }
          return (
            <button
              key={cell.date}
              onClick={() => onDayClick?.(cell)}
              className={cn(
                "relative aspect-square flex flex-col items-center justify-center rounded-md border text-sm transition-colors",
                STATUS_COLORS[cell.status],
                cell.status !== "past" && "cursor-pointer"
              )}
            >
              <span className="font-medium">{cell.dayNum}</span>
              {cell.reservation && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
