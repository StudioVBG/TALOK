"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface SatisfactionRatingProps {
  rating?: number | null;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function SatisfactionRating({
  rating,
  onChange,
  readonly = false,
  size = "md",
}: SatisfactionRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const displayRating = hovered ?? rating ?? 0;

  const sizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={cn(
            "transition-all",
            !readonly && "hover:scale-110 cursor-pointer",
            readonly && "cursor-default"
          )}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(null)}
          onClick={() => !readonly && onChange?.(star)}
        >
          <Star
            className={cn(
              sizes[size],
              "transition-colors",
              star <= displayRating
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground/30"
            )}
          />
        </button>
      ))}
      {rating !== null && rating !== undefined && (
        <span className="text-sm font-medium text-muted-foreground ml-1">
          {rating}/5
        </span>
      )}
    </div>
  );
}
