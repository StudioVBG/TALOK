"use client";

import { AlertTriangle, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExpiryAlertProps {
  expiryDate: string | null;
  label: string;
}

function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function ExpiryAlert({ expiryDate, label }: ExpiryAlertProps) {
  if (!expiryDate) return null;

  const daysLeft = getDaysUntilExpiry(expiryDate);

  if (daysLeft > 60) return null;

  const isExpired = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 30;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
        isExpired
          ? "bg-red-50 text-red-700 border border-red-200"
          : isUrgent
            ? "bg-amber-50 text-amber-700 border border-amber-200"
            : "bg-blue-50 text-blue-700 border border-blue-200"
      }`}
    >
      {isExpired ? (
        <XCircle className="h-4 w-4 shrink-0" />
      ) : isUrgent ? (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      ) : (
        <Clock className="h-4 w-4 shrink-0" />
      )}
      <span>
        <strong>{label}</strong>
        {" : "}
        {isExpired
          ? `expiré depuis ${Math.abs(daysLeft)} jour${Math.abs(daysLeft) > 1 ? "s" : ""}`
          : `expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`}
      </span>
      <Badge
        variant={isExpired ? "destructive" : "secondary"}
        className={`ml-auto shrink-0 ${
          isUrgent && !isExpired ? "bg-amber-200 text-amber-800" : ""
        }`}
      >
        {isExpired ? "Expiré" : isUrgent ? "Urgent" : "Bientôt"}
      </Badge>
    </div>
  );
}
