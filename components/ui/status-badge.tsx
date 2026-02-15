import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type StatusType = "success" | "warning" | "error" | "neutral" | "info";

interface StatusBadgeProps {
  status: string; // Le texte à afficher (ex: "Payé")
  type: StatusType; // La couleur sémantique
  className?: string;
  animate?: boolean;
}

export function StatusBadge({ status, type, className, animate = true }: StatusBadgeProps) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    warning: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    error: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800",
    info: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    neutral: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700",
  };

  const dotColors = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-rose-500",
    info: "bg-blue-500",
    neutral: "bg-slate-500",
  };

  return (
    <Badge
      variant="outline"
      className={cn("pl-2 pr-2.5 py-0.5 gap-1.5 transition-colors font-medium", styles[type], className)}
    >
      {animate && (
        <span className="relative flex h-2 w-2">
          <span className={cn("motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dotColors[type])}></span>
          <span className={cn("relative inline-flex rounded-full h-2 w-2", dotColors[type])}></span>
        </span>
      )}
      {status}
    </Badge>
  );
}
