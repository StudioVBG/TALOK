"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SecondaryContentPanelProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
}

export function SecondaryContentPanel({
  title,
  description,
  children,
  className,
  contentClassName,
  defaultOpen = false,
}: SecondaryContentPanelProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <GlassCard className={cn("overflow-hidden", className)}>
        <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>

        <CollapsibleContent className={cn("border-t border-border p-4", contentClassName)}>
          {children}
        </CollapsibleContent>
      </GlassCard>
    </Collapsible>
  );
}
