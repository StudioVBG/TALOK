import { Suspense } from "react";
import SyndicEntriesClient from "./SyndicEntriesClient";

export const metadata = { title: "Ecritures syndic | Talok" };

export default function SyndicEntriesPage() {
  return (
    <Suspense fallback={<EntriesSkeleton />}>
      <SyndicEntriesClient />
    </Suspense>
  );
}

function EntriesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="h-10 bg-muted rounded-lg w-80" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-96 bg-muted rounded-xl" />
        <div className="h-96 bg-muted rounded-xl" />
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
