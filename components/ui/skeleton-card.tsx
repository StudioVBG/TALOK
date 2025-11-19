"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  showImage?: boolean;
  showFooter?: boolean;
}

export function SkeletonCard({ className, showImage = true, showFooter = false }: SkeletonCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {showImage && (
        <div className="relative h-48 w-full overflow-hidden bg-muted">
          <Skeleton className="h-full w-full animate-shimmer" />
        </div>
      )}
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        {showFooter && (
          <div className="pt-4">
            <Skeleton className="h-10 w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SkeletonPropertyCard() {
  return (
    <Card className="overflow-hidden bg-white/80 backdrop-blur-sm border-slate-200/80">
      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        <Skeleton className="h-full w-full animate-shimmer" />
      </div>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <div className="flex items-center gap-2 mt-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-6 w-32" />
        <div className="pt-2">
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonTableRow() {
  return (
    <tr className="border-b">
      <td className="p-4">
        <Skeleton className="h-4 w-32" />
      </td>
      <td className="p-4">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="p-4">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="p-4">
        <Skeleton className="h-8 w-24 rounded-md" />
      </td>
    </tr>
  );
}

