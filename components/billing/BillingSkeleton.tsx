"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function BillingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-64 bg-slate-700/50" />
          <Skeleton className="h-4 w-96 mt-2 bg-slate-700/50" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40 bg-slate-700/50" />
          <Skeleton className="h-10 w-44 bg-slate-700/50" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan card skeleton */}
        <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <Skeleton className="h-6 w-32 bg-slate-700/50" />
                <Skeleton className="h-4 w-56 mt-2 bg-slate-700/50" />
              </div>
              <Skeleton className="h-6 w-16 bg-slate-700/50 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan info skeleton */}
            <div className="p-4 rounded-xl bg-slate-700/20 border border-slate-700/50">
              <div className="flex items-center gap-4">
                <Skeleton className="w-14 h-14 rounded-xl bg-slate-700/50" />
                <div className="flex-1">
                  <Skeleton className="h-6 w-32 bg-slate-700/50" />
                  <Skeleton className="h-4 w-48 mt-2 bg-slate-700/50" />
                  <Skeleton className="h-3 w-64 mt-2 bg-slate-700/50" />
                </div>
                <div className="text-right">
                  <Skeleton className="h-8 w-24 bg-slate-700/50" />
                  <Skeleton className="h-3 w-32 mt-2 bg-slate-700/50" />
                </div>
              </div>
            </div>

            {/* Billing info skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
                  <Skeleton className="h-3 w-24 bg-slate-700/50" />
                  <Skeleton className="h-5 w-20 mt-2 bg-slate-700/50" />
                </div>
              ))}
            </div>

            {/* Actions skeleton */}
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-10 w-40 bg-slate-700/50" />
              <Skeleton className="h-10 w-28 bg-slate-700/50" />
            </div>
          </CardContent>
        </Card>

        {/* Usage card skeleton */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <Skeleton className="h-6 w-24 bg-slate-700/50" />
            <Skeleton className="h-4 w-48 mt-2 bg-slate-700/50" />
          </CardHeader>
          <CardContent className="space-y-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32 bg-slate-700/50" />
                  <Skeleton className="h-4 w-16 bg-slate-700/50" />
                </div>
                <Skeleton className="h-2 w-full bg-slate-700/50 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Cost breakdown skeleton */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-slate-700/50" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-40 bg-slate-700/50" />
              <Skeleton className="h-4 w-20 bg-slate-700/50" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payment method skeleton */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <Skeleton className="h-6 w-44 bg-slate-700/50" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full bg-slate-700/50 rounded-lg" />
        </CardContent>
      </Card>

      {/* Invoices skeleton */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <Skeleton className="h-6 w-36 bg-slate-700/50" />
          <Skeleton className="h-4 w-64 mt-2 bg-slate-700/50" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full bg-slate-700/50" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
