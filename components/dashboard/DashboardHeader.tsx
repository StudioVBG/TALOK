"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DynamicIcon, type IconName } from "@/lib/icons";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    href: string;
    iconName?: IconName;
  };
  children?: React.ReactNode;
  className?: string;
}

export function DashboardHeader({
  title,
  subtitle,
  action,
  children,
  className,
}: DashboardHeaderProps) {
  return (
    <header className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {children}
        {action && (
          <Button asChild className="shrink-0">
            <Link href={action.href}>
              <DynamicIcon name={action.iconName || "Plus"} className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{action.label}</span>
              <span className="sm:hidden">Ajouter</span>
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
