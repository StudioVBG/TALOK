"use client";

const DPE_COLORS: Record<string, string> = {
  A: "bg-emerald-600",
  B: "bg-emerald-500",
  C: "bg-lime-500",
  D: "bg-yellow-400",
  E: "bg-orange-400",
  F: "bg-orange-600",
  G: "bg-red-600",
};

interface DPERatingBadgeProps {
  rating: string | null | undefined;
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function DPERatingBadge({ rating, size = "md", label }: DPERatingBadgeProps) {
  if (!rating) {
    return (
      <div className="flex items-center gap-2">
        <div className={`
          rounded flex items-center justify-center bg-slate-200 text-slate-500 font-bold
          ${size === "sm" ? "w-6 h-6 text-xs" : size === "lg" ? "w-12 h-12 text-xl" : "w-8 h-8 text-sm"}
        `}>
          ?
        </div>
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
      </div>
    );
  }

  const letter = rating.toUpperCase();
  const color = DPE_COLORS[letter] ?? "bg-slate-400";

  return (
    <div className="flex items-center gap-2">
      <div className={`
        rounded flex items-center justify-center text-white font-bold
        ${color}
        ${size === "sm" ? "w-6 h-6 text-xs" : size === "lg" ? "w-12 h-12 text-xl" : "w-8 h-8 text-sm"}
      `}>
        {letter}
      </div>
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  );
}
