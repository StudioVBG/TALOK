import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  gradient?: boolean;
  hoverEffect?: boolean;
}

export function GlassCard({ children, className, gradient = false, hoverEffect = true, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/40 bg-card/60 backdrop-blur-xl shadow-sm",
        hoverEffect && "transition-all hover:shadow-lg hover:bg-card/80",
        gradient && "bg-gradient-to-br from-card/80 via-card/50 to-primary/5", // Gradient subtil utilisant votre couleur primary
        className
      )}
      {...props}
    >
      {/* Glow Effect subtil en background */}
      {gradient && (
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      )}
      
      {children}
    </div>
  );
}
