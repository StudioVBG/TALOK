"use client";

import { Badge } from "@/components/ui/badge";
import {
  ENGAGEMENT_STATUS_LABELS,
  INVITATION_STATUS_LABELS,
  type EngagementStatus,
  type GuarantorInvitationStatus,
} from "@/lib/types/guarantor";

const engagementStatusStyles: Record<EngagementStatus, string> = {
  pending_signature: "bg-yellow-100 text-yellow-800 border-yellow-200",
  active: "bg-green-100 text-green-800 border-green-200",
  terminated: "bg-gray-100 text-gray-800 border-gray-200",
  called: "bg-red-100 text-red-800 border-red-200",
  released: "bg-blue-100 text-blue-800 border-blue-200",
};

const invitationStatusStyles: Record<GuarantorInvitationStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  accepted: "bg-green-100 text-green-800 border-green-200",
  declined: "bg-red-100 text-red-800 border-red-200",
  expired: "bg-gray-100 text-gray-800 border-gray-200",
};

interface GuarantorStatusBadgeProps {
  status: EngagementStatus | GuarantorInvitationStatus;
  type?: "engagement" | "invitation";
  className?: string;
}

export function GuarantorStatusBadge({
  status,
  type = "engagement",
  className,
}: GuarantorStatusBadgeProps) {
  const labels = type === "engagement" ? ENGAGEMENT_STATUS_LABELS : INVITATION_STATUS_LABELS;
  const styles = type === "engagement" ? engagementStatusStyles : invitationStatusStyles;

  const label = (labels as Record<string, string>)[status] || status;
  const style = (styles as Record<string, string>)[status] || "bg-gray-100 text-gray-800";

  return (
    <Badge variant="outline" className={`${style} ${className || ""}`}>
      {label}
    </Badge>
  );
}
