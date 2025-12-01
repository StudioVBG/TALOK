"use client";

import Link from "next/link";
import {
  Building2,
  CreditCard,
  FileText,
  Wrench,
  Users,
  Check,
  Clock,
  AlertCircle,
  LucideIcon,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/design-system/utils";

type ActivityType = "property" | "lease" | "payment" | "ticket" | "tenant" | "document";

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  status?: "success" | "pending" | "error";
  href?: string;
}

const activityIcons: Record<ActivityType, LucideIcon> = {
  property: Building2,
  lease: FileText,
  payment: CreditCard,
  ticket: Wrench,
  tenant: Users,
  document: FileText,
};

const statusIcons: Record<string, LucideIcon> = {
  success: Check,
  pending: Clock,
  error: AlertCircle,
};

const statusColors: Record<string, string> = {
  success: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950",
  pending: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950",
  error: "text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950",
};

interface RecentActivityProps {
  items: Activity[];
  maxItems?: number;
  viewAllHref?: string;
  className?: string;
}

export function RecentActivity({
  items,
  maxItems = 5,
  viewAllHref,
  className,
}: RecentActivityProps) {
  const displayItems = items.slice(0, maxItems);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Activités récentes</CardTitle>
        {viewAllHref && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={viewAllHref}>
              Voir tout
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {displayItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucune activité récente</p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayItems.map((activity) => {
              const Icon = activityIcons[activity.type];
              const StatusIcon = activity.status ? statusIcons[activity.status] : null;
              const statusColor = activity.status ? statusColors[activity.status] : "";

              const content = (
                <div
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg transition-colors",
                    activity.href && "hover:bg-muted/50 cursor-pointer"
                  )}
                >
                  <div className="shrink-0 p-2 rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDate(activity.timestamp)}
                    </p>
                  </div>

                  {StatusIcon && (
                    <div className={cn("shrink-0 p-1.5 rounded-full", statusColor)}>
                      <StatusIcon className="h-3 w-3" />
                    </div>
                  )}
                </div>
              );

              if (activity.href) {
                return (
                  <Link key={activity.id} href={activity.href}>
                    {content}
                  </Link>
                );
              }

              return <div key={activity.id}>{content}</div>;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

