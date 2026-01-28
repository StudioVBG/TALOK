import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsGridSkeleton, ChartSkeleton } from "./dashboard-skeleton";

/**
 * Skeleton pour une carte de transaction
 */
export function TransactionCardSkeleton() {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="text-right space-y-1">
        <Skeleton className="h-5 w-20 ml-auto" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
    </div>
  );
}

/**
 * Skeleton pour une liste de transactions
 */
export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardHeader>
      <CardContent>
        {Array.from({ length: count }).map((_, i) => (
          <TransactionCardSkeleton key={i} />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton pour une ligne de facture
 */
export function InvoiceRowSkeleton() {
  return (
    <tr className="border-b">
      <td className="p-4">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="p-4">
        <Skeleton className="h-4 w-32" />
      </td>
      <td className="p-4">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="p-4">
        <Skeleton className="h-6 w-16 rounded-full" />
      </td>
      <td className="p-4">
        <Skeleton className="h-5 w-20" />
      </td>
      <td className="p-4">
        <Skeleton className="h-8 w-8 rounded" />
      </td>
    </tr>
  );
}

/**
 * Skeleton pour le dashboard financier
 */
export function MoneyDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Stats */}
      <StatsGridSkeleton count={4} />

      {/* Chart + Transactions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <TransactionListSkeleton count={5} />
      </div>

      {/* Factures récentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="p-4 text-left"><Skeleton className="h-4 w-16" /></th>
                  <th className="p-4 text-left"><Skeleton className="h-4 w-20" /></th>
                  <th className="p-4 text-left"><Skeleton className="h-4 w-16" /></th>
                  <th className="p-4 text-left"><Skeleton className="h-4 w-12" /></th>
                  <th className="p-4 text-left"><Skeleton className="h-4 w-16" /></th>
                  <th className="p-4 text-left"><Skeleton className="h-4 w-8" /></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <InvoiceRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
