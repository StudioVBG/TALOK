"use client";

import { AlertTriangle, Shield } from "lucide-react";
import type { InsurancePolicyWithExpiry } from "@/lib/insurance/types";
import { INSURANCE_TYPE_LABELS } from "@/lib/insurance/constants";
import { formatDaysLeft } from "@/lib/insurance/helpers";

interface InsuranceReminderProps {
  policies: InsurancePolicyWithExpiry[];
}

export function InsuranceReminder({ policies }: InsuranceReminderProps) {
  const urgent = policies.filter(
    (p) => p.expiry_status === "expired" || p.expiry_status === "critical"
  );

  if (urgent.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:bg-red-950 dark:border-red-800">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <h3 className="font-semibold text-red-700 dark:text-red-300">
          {urgent.length === 1
            ? "1 assurance requiert votre attention"
            : `${urgent.length} assurances requierent votre attention`}
        </h3>
      </div>
      <ul className="space-y-2">
        {urgent.map((policy) => (
          <li key={policy.id} className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <Shield className="h-4 w-4 flex-shrink-0" />
            <span>
              <strong>{INSURANCE_TYPE_LABELS[policy.insurance_type]}</strong>
              {" — "}
              {policy.insurer_name}
              {" — "}
              {formatDaysLeft(policy.days_until_expiry)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
