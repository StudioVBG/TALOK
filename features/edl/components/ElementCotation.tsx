"use client";

import { cn } from "@/lib/utils";

export type ConditionLevel =
  | "neuf"
  | "tres_bon"
  | "bon"
  | "usage_normal"
  | "moyen"
  | "mauvais"
  | "tres_mauvais";

const CONDITION_OPTIONS: {
  value: ConditionLevel;
  label: string;
  color: string;
  bgColor: string;
}[] = [
  {
    value: "neuf",
    label: "Neuf",
    color: "text-blue-700",
    bgColor: "bg-blue-100 border-blue-300",
  },
  {
    value: "tres_bon",
    label: "Très bon",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100 border-emerald-300",
  },
  {
    value: "bon",
    label: "Bon",
    color: "text-green-700",
    bgColor: "bg-green-100 border-green-300",
  },
  {
    value: "usage_normal",
    label: "Usage normal",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100 border-yellow-300",
  },
  {
    value: "mauvais",
    label: "Mauvais",
    color: "text-orange-700",
    bgColor: "bg-orange-100 border-orange-300",
  },
  {
    value: "tres_mauvais",
    label: "Très mauvais",
    color: "text-red-700",
    bgColor: "bg-red-100 border-red-300",
  },
];

interface ElementCotationProps {
  value: ConditionLevel | null;
  onChange: (value: ConditionLevel) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ElementCotation({
  value,
  onChange,
  disabled = false,
  compact = false,
}: ElementCotationProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", compact && "gap-1")}>
      {CONDITION_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
            compact && "px-2 py-0.5 text-[10px]",
            value === opt.value
              ? cn(opt.bgColor, opt.color, "shadow-sm ring-1 ring-current/20")
              : "bg-card text-muted-foreground border-border hover:bg-muted",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function getConditionLabel(condition: string | null): string {
  if (!condition) return "Non évalué";
  const opt = CONDITION_OPTIONS.find((o) => o.value === condition);
  return opt?.label || condition;
}

export function getConditionColor(condition: string | null): string {
  if (!condition) return "text-muted-foreground";
  const opt = CONDITION_OPTIONS.find((o) => o.value === condition);
  return opt?.color || "text-muted-foreground";
}

export function getConditionBgColor(condition: string | null): string {
  if (!condition) return "bg-muted";
  const opt = CONDITION_OPTIONS.find((o) => o.value === condition);
  return opt?.bgColor || "bg-muted";
}

export { CONDITION_OPTIONS };
