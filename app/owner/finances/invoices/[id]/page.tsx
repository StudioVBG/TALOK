import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceDetailClient } from "./InvoiceDetailClient";

export const metadata = {
  title: "Détail facture — Talok",
};

export default function InvoiceDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      }
    >
      <InvoiceDetailClient />
    </Suspense>
  );
}
