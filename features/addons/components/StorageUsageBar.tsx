"use client";

import { Progress } from "@/components/ui/progress";

interface StorageUsageBarProps {
  usedMB: number;
  planLimitMB: number;
  addonMB: number;
}

function formatStorage(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} Go`;
  }
  return `${mb} Mo`;
}

export function StorageUsageBar({
  usedMB,
  planLimitMB,
  addonMB,
}: StorageUsageBarProps) {
  const totalMB = planLimitMB + addonMB;
  const isUnlimited = planLimitMB === -1;
  const percentage = isUnlimited ? 0 : totalMB > 0 ? (usedMB / totalMB) * 100 : 0;
  const isWarning = percentage >= 80;
  const isDanger = percentage >= 95;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Stockage</span>
        <span className="font-medium">
          {isUnlimited ? (
            <>{formatStorage(usedMB)} (illimité)</>
          ) : (
            <>
              {formatStorage(usedMB)} / {formatStorage(totalMB)}
              {addonMB > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  (dont {formatStorage(addonMB)} add-on)
                </span>
              )}
            </>
          )}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percentage}
          className={
            isDanger
              ? "[&>div]:bg-destructive"
              : isWarning
                ? "[&>div]:bg-orange-500"
                : ""
          }
        />
      )}
    </div>
  );
}
