"use client";

import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

function getStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "Faible", color: "bg-red-500" };
  if (score <= 3) return { score, label: "Moyen", color: "bg-amber-500" };
  if (score <= 4) return { score, label: "Bon", color: "bg-blue-500" };
  return { score, label: "Fort", color: "bg-emerald-500" };
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const { score, label, color } = getStrength(password);

  if (!password) return null;

  const maxScore = 6;
  const percentage = (score / maxScore) * 100;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
        <div
          className={cn("h-full rounded-full transition-all duration-300", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className={cn("text-xs", score <= 2 ? "text-red-400" : score <= 3 ? "text-amber-400" : score <= 4 ? "text-blue-400" : "text-emerald-400")}>
        {label}
      </p>
    </div>
  );
}
