"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReservationSource } from "@/lib/types/seasonal";

const SOURCE_CONFIG: Record<ReservationSource, { label: string; className: string }> = {
  direct: { label: "Direct", className: "bg-primary/10 text-primary border-primary/30" },
  airbnb: { label: "Airbnb", className: "bg-rose-100 text-rose-700 border-rose-300" },
  booking: { label: "Booking", className: "bg-blue-100 text-blue-700 border-blue-300" },
  other: { label: "Autre", className: "bg-gray-100 text-gray-700 border-gray-300" },
};

interface BookingSourceBadgeProps {
  source: ReservationSource;
}

export function BookingSourceBadge({ source }: BookingSourceBadgeProps) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.other;
  return (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}
