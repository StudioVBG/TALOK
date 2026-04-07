import { Suspense } from "react";
import EntriesPageClient from "./EntriesPageClient";

export const metadata = { title: "Ecritures comptables | Talok" };

export default function EntriesPage() {
  return (
    <Suspense fallback={<EntriesPageSkeleton />}>
      <EntriesPageClient />
    </Suspense>
  );
}

function EntriesPageSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="flex flex-wrap gap-3">
        <div className="h-10 bg-muted rounded-lg w-48" />
        <div className="h-10 bg-muted rounded-lg w-32" />
        <div className="h-10 bg-muted rounded-lg w-32" />
        <div className="h-10 bg-muted rounded-lg w-32" />
      </div>
      <div className="h-96 bg-muted rounded-xl" />
      <div className="h-12 bg-muted rounded-xl" />
    </div>
  );
}
