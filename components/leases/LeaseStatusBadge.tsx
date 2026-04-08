"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { getStatusBadgeProps } from "@/lib/types/status";
import type { LeaseStatus } from "@/lib/types/status";

interface LeaseStatusBadgeProps {
  statut: string;
  className?: string;
  animate?: boolean;
}

/**
 * Reusable badge component for lease status display.
 * Uses centralized status labels and color variants from lib/types/status.ts.
 */
export function LeaseStatusBadge({ statut, className, animate }: LeaseStatusBadgeProps) {
  const { label, type } = getStatusBadgeProps("lease", statut);

  return (
    <StatusBadge
      status={label}
      type={type}
      className={className}
      animate={animate ?? isAnimatedStatus(statut as LeaseStatus)}
    />
  );
}

/** Only animate statuses that represent an in-progress or attention-needed state */
function isAnimatedStatus(statut: LeaseStatus): boolean {
  return [
    "pending_signature",
    "partially_signed",
    "pending_owner_signature",
    "notice_given",
  ].includes(statut);
}
