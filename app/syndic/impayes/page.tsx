import { Suspense } from "react";
import ImpayesClient from "./ImpayesClient";

export const metadata = { title: "Impayes | Talok Syndic" };

export default function ImpayesPage() {
  return (
    <Suspense fallback={<ImpayesSkeleton />}>
      <ImpayesClient />
    </Suspense>
  );
}

function ImpayesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-52" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-72 bg-muted rounded-xl" />
    </div>
  );
}
