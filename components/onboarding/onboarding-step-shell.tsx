import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface OnboardingStepShellProps {
  icon: LucideIcon;
  step: string;
  title: string;
  description: string;
  asideTitle: string;
  asideDescription: string;
  tips: string[];
  children: ReactNode;
  embedded?: boolean;
}

export function OnboardingStepShell({
  icon: Icon,
  step,
  title,
  description,
  asideTitle,
  asideDescription,
  tips,
  children,
  embedded = false,
}: OnboardingStepShellProps) {
  return (
    <div className={cn(
      "px-4 py-6",
      !embedded && "min-h-screen bg-gradient-to-br from-background via-background to-muted/70 py-8"
    )}>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{step}</p>
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
          </div>

          <Card className="border-border shadow-sm">
            <CardContent className="p-6">{children}</CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{asideTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{asideDescription}</p>
              </div>

              <div className="space-y-3">
                {tips.map((tip) => (
                  <div key={tip} className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                    {tip}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
