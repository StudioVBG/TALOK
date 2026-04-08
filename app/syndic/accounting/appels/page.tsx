import { Suspense } from "react";
import AppelsClient from "./AppelsClient";

export const metadata = { title: "Appels de fonds | Talok" };

export default function AppelsPage() {
  return (
    <Suspense fallback={<AppelsSkeleton />}>
      <AppelsClient />
    </Suspense>
  );
}

function AppelsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-52" />
      <div className="flex gap-3">
        <div className="h-10 bg-muted rounded-lg w-48" />
        <div className="h-10 bg-muted rounded-lg w-40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-44 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-72 bg-muted rounded-xl" />
    </div>
  );
}
