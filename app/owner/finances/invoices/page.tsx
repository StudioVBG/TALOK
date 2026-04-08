import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoicesListClient } from "./InvoicesListClient";

export const metadata = {
  title: "Factures — Talok",
};

export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <InvoicesListClient />
    </Suspense>
  );
}
