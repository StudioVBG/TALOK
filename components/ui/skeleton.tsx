import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  srText?: string;
}

function Skeleton({
  className,
  srText = "Chargement...",
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-background/60 before:to-transparent",
        className
      )}
      {...props}
    >
      <span className="sr-only">{srText}</span>
    </div>
  );
}

function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full"
          )}
          srText={i === 0 ? "Chargement du contenu..." : undefined}
        />
      ))}
    </div>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-lg border bg-card p-4 space-y-3", className)}
      role="status"
      aria-busy="true"
    >
      <Skeleton className="h-4 w-1/2" srText="Chargement de la carte..." />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <span className="sr-only">Chargement de la carte...</span>
    </div>
  );
}

function SkeletonAvatar({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <Skeleton
      className={cn("rounded-full", sizeClasses[size], className)}
      srText="Chargement de l'avatar..."
    />
  );
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar };
