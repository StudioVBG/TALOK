"use client";

interface CompletenessBarProps {
  score: number; // 0-100
  showLabel?: boolean;
}

export function CompletenessBar({ score, showLabel = true }: CompletenessBarProps) {
  const getColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Dossier {score}%
        </span>
      )}
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor(score)}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}
