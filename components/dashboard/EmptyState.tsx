"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DynamicIcon, type IconName } from "@/lib/icons";

interface EmptyStateProps {
  iconName?: IconName;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
    iconName?: IconName;
  };
  className?: string;
}

export function EmptyState({
  iconName = "FolderOpen",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-12 px-4", className)}>
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
        <DynamicIcon name={iconName} className="h-8 w-8 text-muted-foreground" />
      </div>

      <h3 className="text-lg font-semibold mb-1">{title}</h3>

      {description && (
        <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
          {description}
        </p>
      )}

      {action && (
        <Button asChild>
          <Link href={action.href}>
            <DynamicIcon name={action.iconName || "Plus"} className="h-4 w-4 mr-2" />
            {action.label}
          </Link>
        </Button>
      )}
    </div>
  );
}
