"use client";

import { Progress } from "@/components/ui/progress";

interface SignatureUsageBarProps {
  used: number;
  planLimit: number;
  addonRemaining: number;
}

export function SignatureUsageBar({
  used,
  planLimit,
  addonRemaining,
}: SignatureUsageBarProps) {
  const total = planLimit + addonRemaining;
  const isUnlimited = planLimit === -1;
  const percentage = isUnlimited ? 0 : total > 0 ? (used / total) * 100 : 0;
  const isWarning = percentage >= 80;
  const isDanger = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Signatures ce mois</span>
        <span className="font-medium">
          {isUnlimited ? (
            <>{used} (illimité)</>
          ) : (
            <>
              {used} / {total}
              {addonRemaining > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  (dont {addonRemaining} add-on)
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
