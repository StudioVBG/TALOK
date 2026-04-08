"use client";

import { Shield, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SolidarityBadgeProps {
  endDate: string;
  className?: string;
}

export function SolidarityBadge({ endDate, className }: SolidarityBadgeProps) {
  const date = new Date(endDate);
  const now = new Date();
  const isExpired = date < now;

  // Calculate remaining days
  const diffMs = date.getTime() - now.getTime();
  const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (isExpired) {
    return (
      <Badge variant="outline" className={`text-gray-500 ${className || ""}`}>
        <ShieldOff className="h-3 w-3 mr-1" />
        Solidarite expiree
      </Badge>
    );
  }

  const isUrgent = remainingDays <= 30;

  return (
    <Badge
      variant="outline"
      className={`${isUrgent ? "text-amber-600 border-amber-300 bg-amber-50" : "text-blue-600 border-blue-300 bg-blue-50"} ${className || ""}`}
    >
      <Shield className="h-3 w-3 mr-1" />
      Solidaire jusqu&apos;au {date.toLocaleDateString("fr-FR")}
      {isUrgent && ` (${remainingDays}j)`}
    </Badge>
  );
}
