"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Collection de composants Skeleton réutilisables
 */

// Skeleton pour une carte de statistique
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// Skeleton pour une ligne de tableau
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center space-x-4 py-3 border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === 0 ? "w-32" : i === columns - 1 ? "w-20" : "w-24"
          )}
        />
      ))}
    </div>
  );
}

// Skeleton pour une liste de propriétés
export function PropertyCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 w-full rounded-none" />
      <CardContent className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex justify-between items-center pt-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton pour une carte de locataire
export function TenantCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton pour une facture
export function InvoiceRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-4 border-b">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

// Skeleton pour un ticket/demande
export function TicketCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton pour un document
export function DocumentCardSkeleton() {
  return (
    <Card className="p-3">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </Card>
  );
}

// Skeleton pour la page dashboard propriétaire
export function OwnerDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Properties */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-16 w-16 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 py-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Skeleton pour la page dashboard locataire
export function TenantDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Welcome Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Lease Info */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Skeleton pour une liste générique
export function ListSkeleton({ count = 5, type = "default" }: { count?: number; type?: "property" | "tenant" | "invoice" | "ticket" | "document" | "default" }) {
  const SkeletonComponent = {
    property: PropertyCardSkeleton,
    tenant: TenantCardSkeleton,
    invoice: InvoiceRowSkeleton,
    ticket: TicketCardSkeleton,
    document: DocumentCardSkeleton,
    default: () => <TableRowSkeleton columns={4} />,
  }[type];

  return (
    <div className={cn(
      type === "property" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-2"
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
}

export default {
  StatCardSkeleton,
  TableRowSkeleton,
  PropertyCardSkeleton,
  TenantCardSkeleton,
  InvoiceRowSkeleton,
  TicketCardSkeleton,
  DocumentCardSkeleton,
  OwnerDashboardSkeleton,
  TenantDashboardSkeleton,
  ListSkeleton,
};

